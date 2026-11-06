import json
import os
import re
from urllib.error import URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from flask import Flask, jsonify, render_template, request

app = Flask(__name__, static_folder="public/static", static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 2048

TASK_POINTS = {
    "file-workflow": 10,
    "case-insensitive-search": 20,
    "edit-file": 20,
}
PLAYER_KEY_PREFIX = "shellyeah:player:"
LEADERBOARD_KEY = "shellyeah:leaderboard"
LEADERBOARD_LIMIT = 50


class RedisUnavailable(Exception):
    pass


def redis_command(*parts):
    base_url = os.environ.get("UPSTASH_REDIS_REST_URL", "").rstrip("/")
    token = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")
    if not base_url or not token:
        raise RedisUnavailable(
            "Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL and "
            "UPSTASH_REDIS_REST_TOKEN on the Flask server."
        )

    path = "/".join(quote(str(part), safe="") for part in parts)
    req = Request(
        f"{base_url}/{path}",
        headers={"Authorization": f"Bearer {token}"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=5) as response:
            result = json.loads(response.read())
    except (URLError, TimeoutError, UnicodeDecodeError, json.JSONDecodeError, ValueError):
        raise RedisUnavailable(
            "Upstash Redis request failed. Check the URL, token, and network connection."
        ) from None

    if not isinstance(result, dict) or result.get("error") is not None:
        raise RedisUnavailable("Upstash Redis returned an invalid response.")
    return result.get("result")


def redis_pipeline(commands):
    base_url = os.environ.get("UPSTASH_REDIS_REST_URL", "").rstrip("/")
    token = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")
    if not base_url or not token:
        raise RedisUnavailable(
            "Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL and "
            "UPSTASH_REDIS_REST_TOKEN on the Flask server."
        )

    req = Request(
        f"{base_url}/pipeline",
        data=json.dumps(commands).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=5) as response:
            results = json.loads(response.read())
    except (URLError, TimeoutError, UnicodeDecodeError, json.JSONDecodeError, ValueError):
        raise RedisUnavailable(
            "Upstash Redis request failed. Check the URL, token, and network connection."
        ) from None

    if not isinstance(results, list) or any(
        not isinstance(item, dict) or item.get("error") is not None
        for item in results
    ):
        raise RedisUnavailable("Upstash Redis returned invalid leaderboard data.")
    return [item.get("result") for item in results]


def player_key(phone):
    return f"{PLAYER_KEY_PREFIX}{phone}"


def read_player(phone):
    fields = redis_command("hgetall", player_key(phone))
    if not isinstance(fields, list) or len(fields) % 2:
        raise RedisUnavailable("Upstash Redis returned invalid player data.")
    data = dict(zip(fields[::2], fields[1::2]))
    try:
        points = int(data.get("points", "0"))
    except (TypeError, ValueError):
        raise RedisUnavailable("Upstash Redis returned invalid player data.") from None
    achievements = [
        task_id for task_id in TASK_POINTS if data.get(f"task:{task_id}") == "1"
    ]
    return {"name": data.get("name", ""), "points": points, "achievements": achievements}


def redis_error(error):
    app.logger.error("Upstash Redis request failed: %s", error)
    return jsonify(error=str(error)), 503


@app.get("/")
def home():
    return render_template("index.html")


@app.post("/api/login")
def login():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(error="Send a phone number and name as JSON."), 400

    phone = data.get("phone")
    name = data.get("name")
    if not isinstance(phone, str) or not re.fullmatch(r"\+?[1-9]\d{7,14}", phone.strip()):
        return jsonify(error="Enter a phone number in international format (8–15 digits)."), 400
    if (
        not isinstance(name, str)
        or not name.strip()
        or len(name.strip()) > 50
        or any(ord(char) < 32 for char in name)
    ):
        return jsonify(error="Enter a name of 1–50 characters."), 400

    phone = phone.strip()
    name = name.strip()
    try:
        redis_command("hset", player_key(phone), "phone", phone, "name", name)
        player = read_player(phone)
        if player["points"] > 0:
            redis_command("zadd", LEADERBOARD_KEY, "GT", player["points"], phone)
    except RedisUnavailable as error:
        return redis_error(error)
    return jsonify(phone=phone, **player)


@app.get("/api/leaderboard")
def leaderboard():
    try:
        sorted_players = redis_command(
            "zrevrange",
            LEADERBOARD_KEY,
            "0",
            min(LEADERBOARD_LIMIT, max(1, request.args.get("limit", default=20, type=int) or 20)) - 1,
            "WITHSCORES",
        )
        if not isinstance(sorted_players, list) or len(sorted_players) % 2:
            return redis_error(RedisUnavailable("Upstash Redis returned invalid leaderboard data."))
        phones = sorted_players[::2]
        names = redis_pipeline([["HGET", player_key(phone), "name"] for phone in phones])
    except RedisUnavailable as error:
        return redis_error(error)

    if len(names) != len(phones):
        return redis_error(RedisUnavailable("Upstash Redis returned invalid leaderboard data."))

    rows = []
    for name, points in zip(names, sorted_players[1::2]):
        try:
            points = int(points)
        except (TypeError, ValueError):
            return redis_error(RedisUnavailable("Upstash Redis returned invalid leaderboard data."))
        if not isinstance(name, str) or not name:
            continue
        rows.append({"rank": len(rows) + 1, "name": name, "points": points})
    return jsonify(entries=rows)


@app.post("/api/award")
def award():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(error="Send a phone number and task ID as JSON."), 400

    phone = data.get("phone")
    task_id = data.get("task")
    if not isinstance(phone, str) or not re.fullmatch(r"\+?[1-9]\d{7,14}", phone):
        return jsonify(error="Log in with a valid phone number first."), 400
    if not isinstance(task_id, str) or task_id not in TASK_POINTS:
        return jsonify(error="Unknown task."), 400

    task_points = TASK_POINTS[task_id]
    script = (
        "if redis.call('HGET', KEYS[1], 'name') == false then return redis.error_reply('player not found') end "
        "local awarded = redis.call('HSETNX', KEYS[1], ARGV[1], '1') "
        "local points = redis.call('HGET', KEYS[1], 'points') or '0' "
        "if awarded == 1 then points = redis.call('HINCRBY', KEYS[1], 'points', tonumber(ARGV[2])) end "
        "return {awarded, points}"
    )
    try:
        result = redis_command(
            "eval",
            script,
            "1",
            player_key(phone),
            f"task:{task_id}",
            task_points,
        )
    except RedisUnavailable as error:
        return redis_error(error)
    if not isinstance(result, list) or len(result) != 2:
        return redis_error(RedisUnavailable("Upstash Redis returned invalid score data."))
    try:
        points = int(result[1])
        redis_command("zadd", LEADERBOARD_KEY, "GT", points, phone)
        player = read_player(phone)
    except (RedisUnavailable, TypeError, ValueError) as error:
        if isinstance(error, RedisUnavailable):
            return redis_error(error)
        return redis_error(RedisUnavailable("Upstash Redis returned invalid score data."))
    return jsonify(
        awarded=result[0] == 1,
        points=player["points"],
        achievements=player["achievements"],
    )


if __name__ == "__main__":
    app.run()
