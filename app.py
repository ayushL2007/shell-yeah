from flask import Flask, render_template

app = Flask(__name__, static_folder="public/static", static_url_path="/static")


@app.get("/")
def home():
    return render_template("index.html")


if __name__ == "__main__":
    app.run()
