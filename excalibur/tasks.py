# -*- coding: utf-8 -*-

import os
import glob
import json
import logging
import subprocess
import datetime as dt
import pandas as pd

import camelot
from camelot.core import TableList
from camelot.parsers import Lattice, Stream
from camelot.ext.ghostscript import Ghostscript

from . import configuration as conf
from .models import File, Rule, Job
from .settings import Session
from .utils.file import mkdirs
from .utils.task import (get_pages, save_page, get_page_layout, get_file_dim,
                         get_image_dim)


def split(file_id):
    try:
        session = Session()
        file = session.query(File).filter(File.file_id == file_id).first()
        extract_pages, total_pages = get_pages(file.filepath, file.pages)

        filenames, filepaths, imagenames, imagepaths, filedims, imagedims, detected_areas = ({} for i in range(7))
        for page in extract_pages:
            # extract into single-page PDF
            save_page(file.filepath, page)

            filename = 'page-{}.pdf'.format(page)
            filepath = os.path.join(conf.PDFS_FOLDER, file_id, filename)
            imagename = ''.join([filename.replace('.pdf', ''), '.png'])
            imagepath = os.path.join(conf.PDFS_FOLDER, file_id, imagename)

            # convert single-page PDF to PNG
            gs_call = '-q -sDEVICE=pngalpha -dBackgroundColor=16#000000 -o {} -r300 {}'.format(
                imagepath, filepath)
            gs_call = gs_call.encode().split()
            null = open(os.devnull, 'wb')
            with Ghostscript(*gs_call, stdout=null) as gs:
                pass
            null.close()

            filenames[page] = filename
            filepaths[page] = filepath
            imagenames[page] = imagename
            imagepaths[page] = imagepath
            filedims[page] = get_file_dim(filepath)
            imagedims[page] = get_image_dim(imagepath)

            lattice_areas, stream_areas = (None for i in range(2))
            # lattice
            parser = Lattice()
            tables = parser.extract_tables(filepath)
            if len(tables):
                lattice_areas = []
                for table in tables:
                    x1, y1, x2, y2 = table._bbox
                    lattice_areas.append((x1, y2, x2, y1))
            # stream
            parser = Stream()
            tables = parser.extract_tables(filepath)
            if len(tables):
                stream_areas = []
                for table in tables:
                    x1, y1, x2, y2 = table._bbox
                    stream_areas.append((x1, y2, x2, y1))

            detected_areas[page] = {
                'lattice': lattice_areas, 'stream': stream_areas}

        file.extract_pages = json.dumps(extract_pages)
        file.total_pages = total_pages
        file.has_image = True
        file.filenames = json.dumps(filenames)
        file.filepaths = json.dumps(filepaths)
        file.imagenames = json.dumps(imagenames)
        file.imagepaths = json.dumps(imagepaths)
        file.filedims = json.dumps(filedims)
        file.imagedims = json.dumps(imagedims)
        file.detected_areas = json.dumps(detected_areas)

        session.commit()
        session.close()
    except Exception as e:
        logging.exception(e)


def extract(job_id):
    try:
        session = Session()
        job = session.query(Job).filter(Job.job_id == job_id).first()
        rule = session.query(Rule).filter(Rule.rule_id == job.rule_id).first()
        file = session.query(File).filter(File.file_id == job.file_id).first()

        rule_options = json.loads(rule.rule_options)
        flavor = rule_options.pop('flavor')
        pages = rule_options.pop('pages')

        tables = []
        filepaths = json.loads(file.filepaths)
        for p in pages:
            if p not in filepaths:
                continue

            if flavor.lower() == 'lattice':
                kwargs = pages[p]
                parser = Lattice(**kwargs)

                t = parser.extract_tables(filepaths[p])
                for _t in t:
                    _t.page = int(p)
                tables.extend(t)

            else:
                opts = pages[p]
                areas, columns = opts.get("table_areas", None), opts.get("columns", None)
                if areas and columns:
                    page_order = 1
                    for area, column in zip(areas, columns):
                        bbox = [round(v, 2) for v in map(float, area.split(","))] if area else []
                        cols = list(map(float, column.split(","))) if column else []
                        split_text = rule_options.get("split_text", False)

                        if cols and bbox:
                            abs_cols = [round(c + bbox[0], 2) for c in cols]
                            table_region = bbox
                            table_area = ",".join(map(str, bbox))
                            table_columns = ",".join(map(str, abs_cols))
                            if len(abs_cols) > 4 and split_text:
                                split_text = False

                        elif bbox:
                            table_region = bbox
                            table_area = ",".join(map(str, bbox))
                            table_columns = None
                            split_text = False

                        else:
                            table_region = None
                            table_area = None
                            table_columns = None

                        kwargs = dict(
                            table_regions=[table_region] if table_region else None,
                            table_areas=[table_area] if table_area else None,
                            columns=[table_columns] if table_columns else None,
                            row_tol=rule_options.get("row_close_tol", 2),
                            column_tol=rule_options.get("col_close_tol", 0),
                            edge_tol=rule_options.get("edge_close_tol", 50),
                            flag_size=rule_options.get("flag_size", False),
                            split_text=split_text,
                            strip_text=rule_options.get("strip_text", ""),
                        )
                        print(f"Using Stream({kwargs!r})")
                        parser = Stream(**kwargs)
                        t = parser.extract_tables(filepaths[p])
                        print(f"Result: {t}")
                        df = None
                        for _t in t:

                            _t.page = int(p)
                            _t.order = page_order
                            print(f"Table {_t.order}, Page {_t.page}: {_t.parsing_report}")

                            if _t.df.shape == (1, 2):
                                _t.df = _t.df.T

                            elif _t.shape == (1, 1):
                                _t.df = pd.concat([_t.df[0], _t.df.replace({0: {_t.df.iat[0, 0]: ''}})[0]], axis=0, ignore_index=True)

                            if len(_t.df.shape) < 2:
                                _t.df = _t.df.to_frame()

                            if _t.df.shape[1] < 4:
                                _t.df = _t.df.replace({"": pd.np.nan}).dropna(how="all")

                            if False:
                                if df is None:
                                    df = _t.df


                                if _t.df.shape[1] == 1:
                                    if df is not None:
                                        df = df.append(_t.df[0].to_frame(), ignore_index=True)

                                elif _t.df.shape[1] >= 2:
                                    if df is not None:
                                        df = df.append(
                                            pd.concat([_t.df[i].to_frame() for i in range(_t.df.shape[1])], axis=0, ignore_index=True),
                                            ignore_index=True
                                        )

                                if df is not None and len(df.shape) == 1:
                                    df = df.to_frame()

                                if df is not None:
                                    _t.df = df
                                else:
                                    df = _t.df

                                    print(df)
                                    print("-------------")

                            print(_t.df)
                            page_order += 1
                        tables.extend(t)
                else:
                    continue

        tables = TableList(tables)

        froot, fext = os.path.splitext(file.filename)
        datapath = os.path.dirname(file.filepath)
        for f in ['csv', 'excel', 'json', 'html']:
            f_datapath = os.path.join(datapath, f)
            for dirname, dirs, files in os.walk(datapath):
                for of in files:
                    if of.endswith(("." + f, ".zip")):
                        fp = os.path.join(dirname, of)
                        os.remove(fp)

            try:
                os.removedirs(f_datapath)
            except FileNotFoundError:
                pass

            mkdirs(f_datapath)
            ext = f if f != 'excel' else 'xlsx'
            f_datapath = os.path.join(f_datapath, '{}.{}'.format(froot, ext))
            tables.export(f_datapath, f=f, compress=True)

        # for render
        jsonpath = os.path.join(datapath, 'json')
        jsonpath = os.path.join(jsonpath, '{}.json'.format(froot))
        tables.export(jsonpath, f='json')
        render_files = {os.path.splitext(os.path.basename(f))[0]: f
            for f in glob.glob(os.path.join(datapath, 'json/*.json'))}

        job.datapath = datapath
        job.render_files = json.dumps(render_files)
        job.is_finished = True
        job.finished_at = dt.datetime.now()

        session.commit()
        session.close()
    except Exception as e:
        logging.exception(e)
