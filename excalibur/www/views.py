# -*- coding: utf-8 -*-

import datetime as dt
import glob
import json
import os
import re

import pandas as pd
from flask import (
    Blueprint,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    url_for,
)
from werkzeug import secure_filename

from .. import configuration as conf
from ..executors import get_default_executor
from ..models import File, Job, Rule
from ..settings import Session
from ..utils.file import allowed_filename, mkdirs, ocr_file
from ..utils.metadata import generate_uuid, random_string

views = Blueprint("views", __name__)


@views.route("/", methods=["GET"])
def index():
    return redirect(url_for("views.files"))


@views.route("/files", methods=["GET", "POST"])
def files():
    if request.method == "GET":
        files_response = []
        session = Session()
        for file in session.query(File).order_by(File.uploaded_at.desc()).all():
            job = (
                session.query(Job)
                .filter(Job.file_id == file.file_id)
                .order_by(Job.started_at.desc())
                .first()
            )
            files_response.append(
                {
                    "file_id": file.file_id,
                    "job_id": job.job_id if job is not None else "",
                    "uploaded_at": file.uploaded_at.strftime("%Y-%m-%dT%H:%M:%S"),
                    "filename": file.filename,
                }
            )
        session.close()
        return render_template("files.html", files_response=files_response)
    file = request.files["file-0"]
    if file and allowed_filename(file.filename):
        file_id = generate_uuid()
        uploaded_at = dt.datetime.now()
        pages = request.form["pages"]
        filename = secure_filename(file.filename)
        filepath = os.path.join(conf.PDFS_FOLDER, file_id)
        mkdirs(filepath)
        filepath = os.path.join(filepath, filename)
        file.save(filepath)
        force_ocr = bool(int(request.form.get("ocr_my_pdf", 0)))

        if force_ocr:
            # TODO(dimitern): Make this a job run before the once below!
            print(
                "Force OCR:", filepath, ocr_file(filepath, force_ocr=True), flush=True
            )

        session = Session()
        f = File(
            file_id=file_id,
            uploaded_at=uploaded_at,
            pages=pages,
            filename=filename,
            filepath=filepath,
        )
        session.add(f)
        session.commit()
        session.close()

        command = "excalibur run --task {} --uuid {}".format("split", file_id)
        command_as_list = command.split(" ")
        executor = get_default_executor()
        executor.execute_async(command_as_list)
    return jsonify(file_id=file_id)


@views.route("/workspaces/<string:file_id>", methods=["GET"])
def workspaces(file_id):
    session = Session()
    file = session.query(File).filter(File.file_id == file_id).first()
    rules = session.query(Rule).order_by(Rule.created_at.desc()).all()
    session.close()
    imagepaths, saved_rules = (None for i in range(2))
    filedims, imagedims, detected_areas = ("null" for i in range(3))
    if getattr(file, "has_image", False):
        imagepaths = json.loads(file.imagepaths)
        for page in imagepaths:
            imagepaths[page] = imagepaths[page].replace(
                os.path.join(conf.PROJECT_ROOT, "www"), ""
            )
        filedims = file.filedims
        imagedims = file.imagedims
        detected_areas = file.detected_areas
        saved_rules = [
            {"rule_id": rule.rule_id, "rule_name": rule.rule_name} for rule in rules
        ]
    return render_template(
        "workspace.html",
        filename=file.filename,
        imagepaths=imagepaths,
        filedims=filedims,
        imagedims=imagedims,
        detected_areas=detected_areas,
        saved_rules=saved_rules,
    )


def rule_error(error, status_code=400, **extra):
    err = jsonify(error=error, **extra)
    err.status_code = status_code
    return err


def rule_id_required():
    return rule_error("No rule_id specified!")


def rule_not_found(rule_id, **extra):
    status_code = extra.pop("status_code", 404)
    return rule_error(f"Rule {rule_id} not found!", status_code=status_code, **extra)


@views.route("/rules/<string:rule_id>", methods=["GET"])
def get_rule(rule_id):
    if rule_id is None:
        return rule_id_required()

    message = ""
    rule_options = {}

    session = Session()
    rule = session.query(Rule).filter(Rule.rule_id == rule_id).first()
    session.close()

    if rule is None:
        return rule_not_found(rule_id, rule_options=rule_options)

    try:
        rule_options = json.loads(rule.rule_options)
    except json.JSONDecodeError as err:
        return rule_error(str(err), status_code=500, rule_options=rule.rule_options)

    return jsonify(message=message, rule_options=rule_options)


@views.route("/rules", methods=["GET"])
def get_rules():
    session = Session()
    rules = session.query(Rule).order_by(Rule.created_at.desc()).all()
    session.close()
    saved_rules = []
    for rule in rules:
        try:
            safe_rule_options = json.loads(rule.rule_options, encoding="utf-8")

        except (json.JSONDecodeError, TypeError):
            safe_rule_options = json.dumps(rule.rule_options, ensure_ascii=True)

        else:
            safe_rule_options = json.dumps(safe_rule_options, ensure_ascii=True)

        saved_rules += [
            {
                "rule_id": rule.rule_id,
                "created_at": rule.created_at.strftime("%Y-%m-%dT%H:%M:%S"),
                "rule_name": rule.rule_name,
                "rule_options_safe": safe_rule_options,
            }
        ]

    return render_template("rules.html", saved_rules=saved_rules)


@views.route("/rules/<string:rule_id>", methods=["PATCH"])
def patch_rule(rule_id):
    if rule_id is None:
        return rule_id_required()

    if not request.form:
        return rule_error("No rule_name and/or rule_options provided!")

    session = Session()
    rule = session.query(Rule).filter(Rule.rule_id == rule_id).first()
    if not rule:
        session.close()
        return rule_not_found(rule_id)

    rule.rule_name = request.form.get("rule_name", rule.rule_name)
    rule.rule_options = request.form.get("rule_options", rule.rule_options)

    session.add(rule)
    session.commit()
    session.close()

    return jsonify(message=f"Rule {rule_id} updated")


@views.route("/rules/<string:rule_id>", methods=["DELETE"])
def delete_rule(rule_id):
    if rule_id is None:
        return rule_id_required()

    session = Session()
    rule = session.query(Rule).filter(Rule.rule_id == rule_id).first()
    if not rule:
        session.close()
        return rule_not_found(rule_id)

    session.delete(rule)
    session.commit()
    session.close()
    return jsonify(message=f"Rule {rule_id} deleted")


@views.route("/rules", methods=["POST"])
def post_rule():
    message = "Rule invalid"
    file = request.files["file-0"]
    if file and allowed_filename(file.filename):
        rule_id = generate_uuid()
        created_at = dt.datetime.now()
        rule_name = os.path.splitext(secure_filename(file.filename))[0]
        try:
            raw = file.read()
            rule_options = json.loads(raw)
        except json.JSONDecodeError as err:
            return rule_error(str(err), rule_options=raw)

        message = f"Rule {rule_id} saved"

        session = Session()
        r = Rule(
            rule_id=rule_id,
            created_at=created_at,
            rule_name=rule_name,
            rule_options=rule_options,
        )
        session.add(r)
        session.commit()
        session.close()

    if message.endswith("saved"):
        return jsonify(message=message)

    return rule_error(message)


@views.route("/jobs", methods=["GET", "POST"], defaults={"job_id": None})
@views.route("/jobs/<string:job_id>", methods=["GET"])
def jobs(job_id):
    if request.method == "GET":
        if job_id is not None:
            session = Session()
            job = session.query(Job).filter(Job.job_id == job_id).first()
            session.close()

            data = []
            render_files = json.loads(job.render_files)
            regex = r"page-(\d+)-table-(\d+)"
            for k in sorted(
                render_files,
                key=lambda x: (int(re.split(regex, x)[1]), int(re.split(regex, x)[2])),
            ):
                df = pd.read_json(render_files[k])
                columns = df.columns.values
                records = df.to_dict("records")
                data.append({"title": k, "columns": columns, "records": records})
            return render_template(
                "job.html",
                is_finished=job.is_finished,
                started_at=job.started_at,
                finished_at=job.finished_at,
                datapath=job.datapath,
                data=data,
            )
        jobs_response = []
        session = Session()
        for job in session.query(Job).order_by(Job.started_at.desc()).all():
            file = session.query(File).filter(File.file_id == job.file_id).first()
            jobs_response.append(
                {
                    "filename": file.filename,
                    "job_id": job.job_id,
                    "started_at": job.started_at.strftime("%Y-%m-%dT%H:%M:%S"),
                    "finished_at": job.finished_at.strftime("%Y-%m-%dT%H:%M:%S"),
                }
            )
        session.close()
        return render_template("jobs.html", jobs_response=jobs_response)
    file_id = request.form["file_id"]
    rule_id = request.form["rule_id"]

    session = Session()
    file = session.query(File).filter(File.file_id == file_id).first()
    session.close()

    if not rule_id:
        rule_id = generate_uuid()
        created_at = dt.datetime.now()
        rule_name = "_".join([os.path.splitext(file.filename)[0], random_string(6)])
        rule_options = request.form["rule_options"]

        session = Session()
        r = Rule(
            rule_id=rule_id,
            created_at=created_at,
            rule_name=rule_name,
            rule_options=rule_options,
        )
        session.add(r)
        session.commit()
        session.close()

    else:
        session = Session()
        rule = session.query(Rule).filter(Rule.rule_id == rule_id).first()
        if rule:
            rule.rule_options = request.form["rule_options"]
            session.add(rule)
            session.commit()
        session.close()

    job_id = generate_uuid()
    started_at = dt.datetime.now()

    session = Session()
    j = Job(job_id=job_id, started_at=started_at, file_id=file_id, rule_id=rule_id)
    session.add(j)
    session.commit()
    session.close()

    command = "excalibur run --task {} --uuid {}".format("extract", job_id)
    command_as_list = command.split(" ")
    executor = get_default_executor()
    executor.execute_async(command_as_list)
    return jsonify(job_id=job_id)


@views.route("/jobs/<string:job_id>/<string:page>/<string:table>/", methods=["GET"])
def get_table(job_id, page, table):

    page = int(page or 1)
    table = int(table or 1)
    session = Session()
    job = session.query(Job).filter(Job.job_id == job_id).first()
    session.close()

    data = []
    render_files = json.loads(job.render_files)
    regex = r"page-(\d+)-table-(\d+)"
    for k in sorted(
        render_files,
        key=lambda x: (int(re.split(regex, x)[1]), int(re.split(regex, x)[2])),
    ):
        page_table = k.partition("-page-")[-1]
        df_page, _, df_table = page_table.partition("-table-")
        df_page = int(df_page)
        df_table = int(df_table)
        if page != df_page or table != df_table:
            continue

        df = pd.read_json(render_files[k])
        columns = df.columns.values.tolist()
        records = df.to_dict("records")
        data.append(
            {
                "title": k,
                "columns": columns,
                "records": records,
                "job_id": job_id,
                "page": df_page,
                "table": df_table,
            }
        )
    return jsonify(data)


@views.route("/download", methods=["POST"])
def download():
    job_id = request.form["job_id"]
    f = request.form["format"]

    session = Session()
    job = session.query(Job).filter(Job.job_id == job_id).first()
    session.close()

    datapath = os.path.join(job.datapath, f.lower())
    zipfile = glob.glob(os.path.join(datapath, "*.zip"))[0]

    directory = os.path.join(os.getcwd(), datapath)
    filename = os.path.basename(zipfile)
    return send_from_directory(
        directory=directory, filename=filename, as_attachment=True
    )
