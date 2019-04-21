import json

from flask import Flask, Blueprint
from werkzeug.utils import find_modules, import_string

from .. import configuration as conf
from .views import views


def to_pretty_json(value):
    value = json.loads(value)
    return json.dumps(value, sort_keys=True, indent=4, separators=(",", ": "))


def create_app(config=None):
    app = Flask(__name__)
    app.config.from_object(conf)
    app.register_blueprint(views, url_prefix=conf.APPLICATION_ROOT)
    app.jinja_env.filters["pretty"] = to_pretty_json
    app.config["APPLICATION_ROOT"] = conf.APPLICATION_ROOT
    app.config["STATIC_URL_PATH"] = conf.STATIC_URL_PATH

    return app
