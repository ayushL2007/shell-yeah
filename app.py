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
SUBMISSION_SEQUENCE_KEY = "shellyeah:submission-sequence"
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
            redis_command(
                "eval",
                (
                    "if redis.call('HGET', KEYS[1], 'submittedOrder') == false then "
                    "local order = redis.call('INCR', KEYS[2]) "
                    "redis.call('HSET', KEYS[1], 'submittedOrder', order) "
                    "return order end "
                    "return redis.call('HGET', KEYS[1], 'submittedOrder')"
                ),
                "2",
                player_key(phone),
                SUBMISSION_SEQUENCE_KEY,
            )
            redis_command("zadd", LEADERBOARD_KEY, "GT", player["points"], phone)
    except RedisUnavailable as error:
        return redis_error(error)
    return jsonify(phone=phone, **player)


@app.get("/api/leaderboard")
def leaderboard():
    try:
        limit = min(
            LEADERBOARD_LIMIT,
            max(1, request.args.get("limit", default=20, type=int) or 20),
        )
        entries = redis_command(
            "eval",
            (
                "local players = redis.call('ZRANGE', KEYS[1], 0, -1, 'WITHSCORES') "
                "local rows = {} "
                "for i = 1, #players, 2 do "
                "local phone = players[i] "
                "local key = ARGV[1] .. phone "
                "local order = redis.call('HGET', key, 'submittedOrder') "
                "if not order then "
                "order = redis.call('INCR', KEYS[2]) "
                "redis.call('HSET', key, 'submittedOrder', order) "
                "end "
                "table.insert(rows, {phone, redis.call('HGET', key, 'name') or '', "
                "tonumber(players[i + 1]), tonumber(order)}) "
                "end "
                "table.sort(rows, function(a, b) "
                "if a[3] ~= b[3] then return a[3] > b[3] end "
                "return a[4] < b[4] end) "
                "local result = {} "
                "for i = 1, math.min(tonumber(ARGV[2]), #rows) do "
                "table.insert(result, {rows[i][1], rows[i][2], rows[i][3]}) "
                "end "
                "return result"
            ),
            "2",
            LEADERBOARD_KEY,
            SUBMISSION_SEQUENCE_KEY,
            PLAYER_KEY_PREFIX,
            limit,
        )
    except RedisUnavailable as error:
        return redis_error(error)

    if not isinstance(entries, list):
        return redis_error(RedisUnavailable("Upstash Redis returned invalid leaderboard data."))

    rows = []
    for entry in entries:
        if not isinstance(entry, list) or len(entry) != 3:
            return redis_error(RedisUnavailable("Upstash Redis returned invalid leaderboard data."))
        _, name, points = entry
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
        "if awarded == 1 then "
        "points = redis.call('HINCRBY', KEYS[1], 'points', tonumber(ARGV[2])) "
        "if redis.call('HGET', KEYS[1], 'submittedOrder') == false then "
        "local order = redis.call('INCR', KEYS[2]) "
        "redis.call('HSET', KEYS[1], 'submittedOrder', order) "
        "end "
        "elseif redis.call('HGET', KEYS[1], 'submittedOrder') == false and tonumber(points) > 0 then "
        "local order = redis.call('INCR', KEYS[2]) "
        "redis.call('HSET', KEYS[1], 'submittedOrder', order) "
        "end "
        "return {awarded, points}"
    )
    try:
        result = redis_command(
            "eval",
            script,
            "2",
            player_key(phone),
            SUBMISSION_SEQUENCE_KEY,
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
