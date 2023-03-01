
from datetime import datetime
from email import header
from django.http.response import JsonResponse
from django.shortcuts import render
from django.core.files.storage import FileSystemStorage

from python_nctu_cancer.models import CancerCategoryModel
from python_nctu_cancer.models import CancerLogRankModel
from python_nctu_cancer.models import CancerAftDataModel
from python_nctu_cancer.models import CancerCoxDataModel
from python_nctu_cancer.models import GenomeDataModel
from python_nctu_cancer.models import LogrankDataModel
from python_nctu_cancer.models import MetaFeatureModel
from python_nctu_cancer.Correlation import Correlation
from python_nctu_cancer.NewAft import NewAft
from python_nctu_cancer.BoxPlot import BoxPlot
from python_nctu_cancer.Kmplotter import Kmplotter
from python_nctu_cancer.TwoGene import TwoGene
from python_nctu_cancer.CoxAftTwoGene import CoxAftTwoGene
from python_nctu_cancer.MoreGene import MoreGene

import numpy as np
import random
import json
import plotly as py
from plotly.graph_objs import Data
import subprocess
import traceback
import math
import logging
import os
import re
import pandas as pd
import datetime
import csv

from rest_framework.views import APIView
from rest_framework import generics
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import action
from django.conf import settings
from django.http import HttpResponse, Http404


class CategoryView(APIView):
    def get(self, request, *args, **kwargs):
        param_category = request.GET["category"]
        types = CancerCategoryModel.get_types(param_category)

        result = []
        for cancer_type in types:
            result.append(cancer_type["types"])

        return Response(json.dumps(result))


class LogRankView(APIView):
    def get(self, request, *args, **kwargs):
        param_category = request.GET['category']
        param_cancer_type = request.GET.get('type', "")
        param_gene = request.GET.get('gene', "")
        param_search_type = request.GET.get('search_type', "")
        param_keyword = request.GET.get('keyword', "")
        param_limit = int(request.GET.get('limit', 10))
        param_skip = int(request.GET.get('skip', 10))
        param_sort_col = request.GET.get('sort_col', "")
        param_sort_dir = request.GET.get('sort_dir', "")
        param_search_correlation = request.GET.get('search_correlation', "")
        param_entrez = request.GET.get('entrez', "")
        param_survival_type = request.GET.get('survival_type', "")

        # 初始化 Correlation
        correlation = None
        if param_search_correlation == "1":
            correlation = Correlation()

        # browse或gene頁面查詢
        raw_data = None
        if param_search_type == "gene":
            raw_data = CancerLogRankModel.get_logrank_by_gene(
                param_category, param_gene, param_keyword, param_limit, param_skip, param_sort_col, param_sort_dir, [], param_survival_type)
        else:
            raw_data = CancerLogRankModel.get_logrank(
                param_category, param_cancer_type, param_gene, param_keyword, param_limit, param_skip, param_sort_col, param_sort_dir, [], param_survival_type)

        # 轉換資料
        tmp_list = list(raw_data["data"])
        data = []
        correlations = []
        for i, d in enumerate(tmp_list):
            data2 = {}
            for key in d:
                if key == "_id":
                    continue

                if key in ["os_exp", "fdr_os_p", "pfi_exp", "fdr_pfi_p", "dfi_exp", "fdr_dfi_p", "dss_exp", "fdr_dss_p", "normal_exp", "tumor_exp", "wilcoxon_p_val"]:
                    d2 = CustomFormat.format_val(d, key)
                else:
                    d2 = d[key]
                data2[key] = d2

            if param_search_correlation == "1":
                try:
                    cor_res = correlation.get_correlation_result(
                        param_category, param_cancer_type, param_gene, param_entrez, d["Cgcite"])
                    correlations.append(cor_res)
                except Exception as e:
                    correlations.append([])
                    print(e)

            data.append(data2)

        result = {
            "status": "success",
            "data": {
                "d": data,
                "total": raw_data["total"],
                "correlations": correlations
            }
        }
        return JsonResponse(result)


class LogRankDownloadView(APIView):
    def post(self, request, *args, **kwargs):
        param_category = request.POST.get('category', "")
        param_cancer_type = request.POST.get('type', "")
        param_gene = request.POST.get('gene', "")
        param_keyword = request.POST.get('keyword', "")
        param_sort_col = request.POST.get('sort_col', "")
        param_sort_dir = request.POST.get('sort_dir', "")
        param_tab = request.POST.get('tab', "")
        param_search_type = request.POST.get('search_type', "")

        print("@download params =", param_category, param_cancer_type, param_gene, param_keyword, param_sort_col, param_sort_dir, param_tab, param_search_type)

        fields = []
        if param_tab == "expression":
            if param_category in ["methylation450k", "methylation27k"]:
                fields.append("Cgcite")
            if param_category in ["lncrna"]:
                fields.append("gene_symbol")
            else:
                fields.append("MetaFeature")
            fields.append("type")
            if param_category in ["mrna"]:
                fields.append("Entrez")
            fields.append("normal_exp")
            fields.append("tumor_exp")
            fields.append("wilcoxon_p_val")
        else:
            if param_category in ["methylation450k", "methylation27k"]:
                fields.append("Cgcite")
            if param_category in ["lncrna"]:
                fields.append("gene_symbol")
            else:
                fields.append("MetaFeature")
            fields.append("type")                
            if param_category in ["mrna"]:
                fields.append("Entrez")
            fields.append("os_exp")
            fields.append("fdr_os_p")
            fields.append("pfi_exp")
            fields.append("fdr_pfi_p")
            fields.append("dfi_exp")
            fields.append("fdr_dfi_p")
            fields.append("dss_exp")
            fields.append("fdr_dss_p")
            

        # get data
        if param_search_type == "gene":
            rows = CancerLogRankModel.get_logrank_by_gene(
                    param_category, param_gene, param_keyword, "", "", param_sort_col, param_sort_dir, fields)
        else:
            rows = CancerLogRankModel.get_logrank(
                    param_category, param_cancer_type, param_gene, param_keyword, "", "", param_sort_col, param_sort_dir, fields)

        # write data to csv
        download_dir = "download" + os.sep
        fname = param_cancer_type+'_'+param_tab+'.csv'
        fp = open(download_dir + fname, 'w')
        myFile = csv.writer(fp, lineterminator = '\n') #use lineterminator for windows

        headers = []
        header_mappings = {
            "MetaFeature": "Gene",
            "type": "Type",
            "Entrez": "Entrez ID",
            "os_exp": "P-val (OS)",
            "fdr_os_p": "Adjusted P-val (OS)",
            "pfi_exp": "P-val (PFI)",
            "fdr_pfi_p": "Adjusted P-val (PFI)",
            "dfi_exp": "P-val (DFI)",
            "fdr_dfi_p": "Adjusted P-val (DFI)",
            "dss_exp": "P-val (DSS)",
            "fdr_dss_p": "Adjusted P-val (DSS)",
            "normal_exp": "Expression (Normal)",
            "tumor_exp": "Expression (Tumor)",
            "wilcoxon_p_val": "Wilcoxon P-val",
            "Cgcite": "CpG site",
        }
        for i, d in enumerate(list(rows)):
            tmp_data = []
            for j, d2 in enumerate(fields):
                key = fields[j]
                if i == 0:
                    if key in header_mappings:
                        header_name = header_mappings[key]
                    else:
                        header_name = key
                    headers.append(header_name)
                if key in d:
                    tmp_data.append(d[key])
                else:
                    tmp_data.append("")

            if i == 0:
                myFile.writerow(headers)
            myFile.writerow(tmp_data)
        fp.close()

        # download file
        
        with open(download_dir + fname, 'rb') as fh:
            response = HttpResponse(
                fh.read(), content_type="application/vnd.ms-excel")
            response['Content-Disposition'] = 'inline; filename=' + \
                os.path.basename(download_dir + fname)
            os.remove(download_dir + fname)
            return response


class AftDataView(APIView):
    def get(self, request, *args, **kwargs):
        param_category = request.GET['category']
        param_cancer_type = request.GET.get('type', "")
        param_gene = request.GET.get('gene', "")
        param_search_type = request.GET.get('search_type', "")
        param_keyword = request.GET.get('keyword', "")
        param_limit = int(request.GET.get('limit', 10))
        param_skip = int(request.GET.get('skip', 10))
        param_sort_col = request.GET.get('sort_col', "")
        param_sort_dir = request.GET.get('sort_dir', "")
        param_survival_type = request.GET.get('survival_type', "")

        if param_search_type == "gene":
            raw_data = CancerAftDataModel.get_aftdata_by_gene(
                param_category, param_gene, param_keyword, param_limit, param_skip, param_sort_col, param_sort_dir, [], param_survival_type)
        else:
            raw_data = CancerAftDataModel.get_aftdata(
                param_category, param_cancer_type, param_gene, param_keyword, param_limit, param_skip, param_sort_col, param_sort_dir, [], param_survival_type)

        # 轉換資料
        tmp_list = list(raw_data["data"])
        data = []
        for i, d in enumerate(tmp_list):
            data2 = {}
            for key in d:
                if key == "_id":
                    continue

                if re.search(".+(_os|_pfi|_dfi|_dss)$", key.lower()):
                    d2 = CustomFormat.format_val(d, key)
                else:
                    d2 = d[key]
                data2[key] = d2
            data.append(data2)

        result = {
            "status": "success",
            "data": {
                "d": data,
                "total": raw_data["total"],
            }
        }
        return JsonResponse(result)

class AftDataDownloadView(APIView):
    def post(self, request, *args, **kwargs):
        param_category = request.POST.get('category', "")
        param_cancer_type = request.POST.get('type', "")
        param_gene = request.POST.get('gene', "")
        param_keyword = request.POST.get('keyword', "")
        param_sort_col = request.POST.get('sort_col', "")
        param_sort_dir = request.POST.get('sort_dir', "")
        param_search_type = request.POST.get('search_type', "")

        fields = []
        if param_category in ["methylation450k", "methylation27k"]:
            fields.append("Cgcite")
        if param_category in ["lncrna"]:
            fields.append("gene_symbol")
        else:
            fields.append("MetaFeature")
        fields.append("type")
        fields.append("Entrez")
        fields.append("exp_coef_OS")
        fields.append("exp_p_val_OS")
        fields.append("fdr_exp_os")
        fields.append("exp_coef_PFI")
        fields.append("exp_p_val_PFI")
        fields.append("fdr_exp_pfi")
        fields.append("exp_coef_DFI")
        fields.append("exp_p_val_DFI")
        fields.append("fdr_exp_dfi")
        fields.append("exp_coef_DSS")
        fields.append("exp_p_val_DSS")
        fields.append("fdr_exp_dss")

        # get data
        if param_search_type == "gene":
            rows = CancerAftDataModel.get_aftdata_by_gene(
                    param_category, param_gene, param_keyword, "", "", param_sort_col, param_sort_dir, fields)
        else:
            rows = CancerAftDataModel.get_aftdata(
                    param_category, param_cancer_type, param_gene, param_keyword, "", "", param_sort_col, param_sort_dir, fields)

        # write data to csv
        download_dir = "download" + os.sep
        fname = param_cancer_type+'_aft.csv'
        fp = open(download_dir + fname, 'w')
        myFile = csv.writer(fp, lineterminator = '\n') #use lineterminator for windows

        headers = []
        header_mappings = {
            "MetaFeature": "Gene",
            "type": "Type",
            "Entrez": "Entrez ID",
            "exp_coef_OS": "Coefficient (OS)",
            "exp_p_val_OS": "P-val (OS)",
            "fdr_exp_os": "Adjusted P-val (OS)",
            "exp_coef_PFI": "Coefficient (PFI)",
            "exp_p_val_PFI": "P-val (PFI)",
            "fdr_exp_pfi": "Adjusted P-val (PFI)",
            "exp_coef_DFI": "Coefficient (DFI)",
            "exp_p_val_DFI": "P-val (DFI)",
            "fdr_exp_dfi": "Adjusted P-val (DFI)",
            "exp_coef_DSS": "Coefficient (DSS)",
            "exp_p_val_DSS": "P-val (DSS)",
            "fdr_exp_dss": "Adjusted P-val (DSS)",
            "Cgcite": "CpG site",
        }
        for i, d in enumerate(list(rows)):
            tmp_data = []
            for j, d2 in enumerate(fields):
                key = fields[j]
                if i == 0:
                    if key in header_mappings:
                        header_name = header_mappings[key]
                    else:
                        header_name = key
                    headers.append(header_name)
                if key in d:
                    tmp_data.append(d[key])
                else:
                    tmp_data.append("")

            if i == 0:
                myFile.writerow(headers)
            myFile.writerow(tmp_data)
        fp.close()

        # download file
        with open(download_dir + fname, 'rb') as fh:
            response = HttpResponse(
                fh.read(), content_type="application/vnd.ms-excel")
            response['Content-Disposition'] = 'inline; filename=' + \
                os.path.basename(download_dir + fname)
            os.remove(download_dir + fname)
            return response

class CoxDataView(APIView):
    def get(self, request, *args, **kwargs):
        param_category = request.GET['category']
        param_cancer_type = request.GET.get('type', "")
        param_gene = request.GET.get('gene', "")
        param_search_type = request.GET.get('search_type', "")
        param_keyword = request.GET.get('keyword', "")
        param_limit = int(request.GET.get('limit', 10))
        param_skip = int(request.GET.get('skip', 10))
        param_sort_col = request.GET.get('sort_col', "")
        param_sort_dir = request.GET.get('sort_dir', "")
        param_survival_type = request.GET.get('survival_type', "")

        if param_search_type == "gene":
            raw_data = CancerCoxDataModel.get_coxdata_by_gene(
                param_category, param_gene, param_keyword, param_limit, param_skip, param_sort_col, param_sort_dir,[],param_survival_type)
        else:
            raw_data = CancerCoxDataModel.get_coxdata(
                param_category, param_cancer_type, param_gene, param_keyword, param_limit, param_skip, param_sort_col, param_sort_dir, [], param_survival_type)

        # 轉換資料
        tmp_list = list(raw_data["data"])
        data = []
        for i, d in enumerate(tmp_list):
            data2 = {}
            for key in d:
                if key == "_id":
                    continue

                if re.search(".+(_os|_pfi|_dfi|_dss)$", key.lower()):
                    d2 = CustomFormat.format_val(d, key)
                else:
                    d2 = d[key]
                data2[key] = d2
            data.append(data2)

        result = {
            "status": "success",
            "data": {
                "d": data,
                "total": raw_data["total"],
            }
        }
        return JsonResponse(result)

class CoxDataDownloadView(APIView):
    def post(self, request, *args, **kwargs):
        param_category = request.POST.get('category', "")
        param_cancer_type = request.POST.get('type', "")
        param_gene = request.POST.get('gene', "")
        param_keyword = request.POST.get('keyword', "")
        param_sort_col = request.POST.get('sort_col', "")
        param_sort_dir = request.POST.get('sort_dir', "")
        param_search_type = request.POST.get('search_type', "")

        fields = []
        if param_category in ["methylation450k", "methylation27k"]:
            fields.append("Cgcite")
        if param_category in ["lncrna"]:
            fields.append("gene_symbol")
        else:
            fields.append("MetaFeature")
        fields.append("type")
        fields.append("Entrez")
        fields.append("exp_coef_OS")
        fields.append("exp_p_val_OS")
        fields.append("fdr_exp_os")
        fields.append("exp_coef_PFI")
        fields.append("exp_p_val_PFI")
        fields.append("fdr_exp_pfi")
        fields.append("exp_coef_DFI")
        fields.append("exp_p_val_DFI")
        fields.append("fdr_exp_dfi")
        fields.append("exp_coef_DSS")
        fields.append("exp_p_val_DSS")
        fields.append("fdr_exp_dss")

        # get data
        if param_search_type == "gene":
            rows = CancerCoxDataModel.get_coxdata_by_gene(
                    param_category, param_gene, param_keyword, "", "", param_sort_col, param_sort_dir, fields)
        else:
            rows = CancerCoxDataModel.get_coxdata(
                    param_category, param_cancer_type, param_gene, param_keyword, "", "", param_sort_col, param_sort_dir, fields)

        # write data to csv
        download_dir = "download" + os.sep
        fname = param_cancer_type+'_cox.csv'
        fp = open(download_dir + fname, 'w')
        myFile = csv.writer(fp, lineterminator = '\n') #use lineterminator for windows

        headers = []
        header_mappings = {
            "MetaFeature": "Gene",
            "type": "Type",
            "Entrez": "Entrez ID",
            "exp_coef_OS": "Coefficient (OS)",
            "exp_p_val_OS": "P-val (OS)",
            "fdr_exp_os": "Adjusted P-val (OS)",
            "exp_coef_PFI": "Coefficient (PFI)",
            "exp_p_val_PFI": "P-val (PFI)",
            "fdr_exp_pfi": "Adjusted P-val (PFI)",
            "exp_coef_DFI": "Coefficient (DFI)",
            "exp_p_val_DFI": "P-val (DFI)",
            "fdr_exp_dfi": "Adjusted P-val (DFI)",
            "exp_coef_DSS": "Coefficient (DSS)",
            "exp_p_val_DSS": "P-val (DSS)",
            "fdr_exp_dss": "Adjusted P-val (DSS)",
            "Cgcite": "CpG site",
        }
        for i, d in enumerate(list(rows)):
            tmp_data = []
            for j, d2 in enumerate(fields):
                key = fields[j]
                if i == 0:
                    if key in header_mappings:
                        header_name = header_mappings[key]
                    else:
                        header_name = key
                    headers.append(header_name)
                if key in d:
                    tmp_data.append(d[key])
                else:
                    tmp_data.append("")

            if i == 0:
                myFile.writerow(headers)
            myFile.writerow(tmp_data)
        fp.close()

        # download file
        with open(download_dir + fname, 'rb') as fh:
            response = HttpResponse(
                fh.read(), content_type="application/vnd.ms-excel")
            response['Content-Disposition'] = 'inline; filename=' + \
                os.path.basename(download_dir + fname)
            os.remove(download_dir + fname)
            return response

class FeatureView(APIView):
    def get(self, request, *args, **kwargs):
        param_category = request.GET["category"]
        param_type = request.GET["type"]
        param_words = request.GET["name"]
        param_limit = int(request.GET.get('limit', 10))
        param_skip = int(request.GET.get('skip', 10))

        features = MetaFeatureModel.get_features(
            param_category, param_type, param_words, param_limit, param_skip)

        result = []
        for feature in features:
            result.append(feature["MetaFeature"])

        return Response(json.dumps(result))


class ChartView(APIView):
    def get(self, request, *args, **kwargs):
        resp_message = {
            'status' : 'success'
        }
        try:
            cancer_category = request.GET['category']
            cancer_type = request.GET['type']
            meta_feature = request.GET['feature']
            mode = request.GET['mode']
            time = request.GET.get('time', "0")
            L_per = request.GET.get('L_per', "0")
            H_per = request.GET.get('H_per', "0")

            if time == "":
                time = "0"
            if L_per == "":
                L_per = "0"
            if H_per == "":
                H_per = "0"

            print(cancer_category, cancer_type, meta_feature, mode, time, L_per, H_per)

            if mode == 'Overall':
                mode = 'OS'
            elif mode == 'Disease-Free':
                mode = 'DFI'
            elif mode == 'Progression-Free':
                mode = 'PFI'
            elif mode == 'Disease-Specific':
                mode = 'DSS'

            # 因為直接Kmplotter()時會有cache問題，所以改用subprocess處理
            path = os.path.abspath(os.path.dirname(__name__)) + os.sep
            resp = json.loads(subprocess.check_output(
                ['python', path + 'call_kmplotter.py', cancer_category, cancer_type, meta_feature, mode, time, L_per, H_per]).decode('utf-8'))

            if resp["status"] != 'success':
                raise Exception(resp["message"])
            chart_data = json.loads(json.dumps(resp["data"]["chart_data"], cls = py.utils.PlotlyJSONEncoder))
            
            resp_message["data"] = {
                'chart_data': chart_data
            }

        except Exception as e:
            resp_message["status"] = 'error'
            resp_message["message"] = str(e)

        return JsonResponse(resp_message, safe=False)


class ChartDownloadView(APIView):
    def get(self, request, *args, **kwargs):
        cancer_category = request.GET['category']
        cancer_type = request.GET['type']
        meta_feature = request.GET['feature']
        mode = request.GET['mode']
        time = request.GET.get('time', 0)
        L_per = request.GET.get('L_per', "0")
        H_per = request.GET.get('H_per', "0")

        if time == "":
            time = "0"
        if L_per == "":
            L_per = "0"
        if H_per == "":
            H_per = "0"

        print("@", cancer_category, cancer_type, meta_feature, mode, L_per, H_per)

        if mode == 'Overall':
            mode = 'OS'
        elif mode == 'Disease-Free':
            mode = 'DFI'
        elif mode == 'Progression-Free':
            mode = 'PFI'
        elif mode == 'Disease-Specific':
            mode = 'DSS'

        download_dir = 'download' + os.sep
        if not os.path.exists(download_dir):
            os.makedirs(download_dir)

        kmplotter = Kmplotter()
        data = kmplotter.get_download_data(
            cancer_category, cancer_type, meta_feature, mode, time, L_per, H_per)

        gene = meta_feature
        if gene.find("|") != -1:
            gene = gene.split("|")[0]
        elif gene.find(",") != -1:
            gene = gene.split(",")[0]
        elif gene.find(";") != -1:
            gene = gene.split(";")[0]

        data.to_csv(download_dir + gene + "_" + mode + "_logrank.csv", index=False, encoding='utf-8')
        
        with open(download_dir + gene + "_" + mode + "_logrank.csv", 'rb') as fh:
            response = HttpResponse(
                fh.read(), content_type="application/vnd.ms-excel")
            response['Content-Disposition'] = 'inline; filename=' + \
                os.path.basename(download_dir + gene + "_" + mode + "_logrank.csv")
            # jand download bug
            # os.remove(download_dir + fname)
            os.remove(download_dir + gene + "_" + mode + "_logrank.csv")
            
            return response


class CorrelationView(APIView):
    def get(self, request, *args, **kwargs):
        param_category = request.GET['category']
        param_cancer_type = request.GET['type']
        param_feature = request.GET['feature']
        param_entrez = request.GET['entrez']
        cgcites = request.GET['cgcites']

        result = {
            "status": "success"
        }

        try:
            correlations = []
            correlation = Correlation()

            tmp_cgcites = cgcites.split(",")

            try:
                for cgcite in tmp_cgcites:
                    cor_res = correlation.get_correlation_img(
                        param_category, param_cancer_type, param_feature, param_entrez, cgcite)
                    correlations.append(cor_res)
            except Exception as e1:
                correlations.append([])
                print(e1)

            result["data"] = {
                "correlations": correlations
            }
        except Exception as e2:
            result["status"] = "error"
            result["message"] = str(e2)

        return JsonResponse(result)


class AftPlotView(APIView):
    def post(self, request, *args, **kwargs):
        result = {
            "status": "success"
        }

        try:
            cancer_category = request.POST['category']
            type = request.POST['type']
            feature = request.POST['feature']
            survival_type = request.POST['survival_type']
            cgcite = request.POST.get('cgcite', "")
            tab = request.POST.get('tab', "cox")
            drop_image_columns = request.POST.getlist('drop_image_columns[]')

            print("@data =", cancer_category, type, feature, survival_type)

            new_aft = NewAft()
            data = {}
            if tab == "cox":
                cox_data = new_aft.get_cox_img_data(
                    cancer_category, type, feature, cgcite, survival_type, drop_image_columns)
                data["img"] = cox_data[0]
                data["summary"] = cox_data[1]
                data["test_summary"] = cox_data[2]
            elif tab == "aft":
                cox_data = new_aft.get_aft_img_data(
                    cancer_category, type, feature, cgcite, survival_type, drop_image_columns)
                data["img"] = cox_data[0]
                data["summary"] = cox_data[1]
            else:
                data["img"] = ""
                data["summary"] = []
            result["data"] = data
        except Exception as e:
            result["status"] = "error"
            result["message"] = str(e)

        return JsonResponse(result)


class AftPlotDownloadView(APIView):
    def get(self, request, *args, **kwargs):
        cancer_category = request.GET['category']
        cancer_type = request.GET['type']
        meta_feature = request.GET['feature']
        cgcite = request.GET.get('cgcite', "")
        survival_type = request.GET['survival_type']

        print("@data =", cancer_category, cancer_type,
              meta_feature, survival_type)

        download_dir = 'download' + os.sep
        if not os.path.exists(download_dir):
            os.makedirs(download_dir)

        new_aft = NewAft()
        data = new_aft.get_download_data(
            cancer_category, cancer_type, meta_feature, cgcite, survival_type)

        gene = meta_feature
        if gene.find("|") != -1:
            gene = gene.split("|")[0]
        elif gene.find(",") != -1:
            gene = gene.split(",")[0]
        elif gene.find(";") != -1:
            gene = gene.split(";")[0]

        data.to_csv(download_dir + gene +"_"+survival_type+"_clnical.csv", index=False, encoding='utf-8')
        with open(download_dir + gene +"_"+survival_type+ "_clnical.csv", 'rb') as fh:
            response = HttpResponse(
                fh.read(), content_type="application/vnd.ms-excel")
            response['Content-Disposition'] = 'inline; filename=' + \
                os.path.basename(download_dir + gene +"_"+survival_type+"_clnical.csv")
            os.remove(download_dir + fname)
            return response


class AftPlotUploadView(APIView):
    def post(self, request, *args, **kwargs):
        result = {
            "status": "success"
        }

        # create folder if not exist
        folder = 'uploads'
        if not os.path.isdir(folder):
            os.mkdir(folder)
        fname = ""
        
        try:
            upload_file = request.FILES['upload_file']
            cancer_category = request.POST['category']
            cancer_type = request.POST['type']
            feature = request.POST['feature']
            survival_type = request.POST['survival_type']
            tab = request.POST.get('tab', "cox")
            cgcite = request.POST.get('cgcite', "")

            if upload_file.size > (1000 * 1024):
                raise Exception("File too large")

            print(upload_file.name)
            fss = FileSystemStorage()
            fname = str(datetime.datetime.now().strftime('%Y%m%d%H%M%S')) + "_" + upload_file.name
            file = fss.save(folder + "/" + fname, upload_file)

            print("@data =", cancer_category, cancer_type, feature, survival_type)

            new_aft = NewAft()
            data = {}
            if tab == "cox":
                cox_data = new_aft.get_cox_upload_img_data(
                    cancer_category, cancer_type, feature, cgcite, survival_type, folder + "/" + fname)
                data["img"] = cox_data[0]
                data["summary"] = cox_data[1]
                data["test_summary"] = cox_data[2]
            elif tab == "aft":
                cox_data = new_aft.get_aft_upload_img_data(
                    cancer_category, cancer_type, feature, cgcite, survival_type, folder + "/" + fname)
                data["img"] = cox_data[0]
                data["summary"] = cox_data[1]
            else:
                data["img"] = ""
                data["summary"] = []

            result["data"] = data
        except Exception as e:
            result["status"] = "error"
            result["message"] = str(e)
	
        # remove not used file
        if fname != "" and os.path.exists(folder + "/" + fname):
            os.remove(folder + "/" + fname)

        return JsonResponse(result)


class BoxPlotView(APIView):
    def get(self, request, *args, **kwargs):
        result = {
            "status": "success"
        }

        try:
            cancer_category = request.GET['category']
            gene = request.GET['gene']

            box_plot = BoxPlot()
            data = {}
            data["result"] = box_plot.get_data(cancer_category, gene)
            result["data"] = data
        except Exception as e:
            result["status"] = "error"
            result["message"] = str(e)

        return JsonResponse(result)


class TwoGeneView(APIView):
    def get(self, request, *args, **kwargs):
        result = {
            "status": "success"
        }

        try:
            category1 = request.GET['category1']
            category2 = request.GET['category2']
            cancer_type = request.GET['type']
            gene1 = request.GET['gene1']
            gene2 = request.GET['gene2']
            group1 = request.GET['group1'].split(",")
            group2 = request.GET['group2'].split(",")
            #time = request.GET.get('time','0')

            two_gene = TwoGene()
            data = {
                "d": two_gene.get_data(category1, category2, gene1, gene2, cancer_type, group1, group2),
                "total": 4
            }
            result["data"] = data
        except Exception as e:
            result["status"] = "error"
            result["message"] = str(e)

        return JsonResponse(result)


class TwoGeneImgView(APIView):
    def get(self, request, *args, **kwargs):
        resp_status = 'SUCCESS'
        resp_message = ''
        try:
            category1 = request.GET['category1']
            category2 = request.GET['category2']
            mode = request.GET['mode']
            gene1 = request.GET['gene1']
            gene2 = request.GET['gene2']
            cancer_type = request.GET['type']
            group1 = request.GET['group1']
            group2 = request.GET['group2']
            time = request.GET.get('time', '0')

            print("@p =", category2, mode, cancer_type,
                  gene1, gene2, group1, group2, time)

            # 因為直接Kmplotter()時會有cache問題，所以改用subprocess處理
            path = os.path.abspath(os.path.dirname(__name__)) + os.sep
            if mode == 'Overall':
                mode = 'OS'
            elif mode == 'Disease-Free':
                mode = 'DFI'
            elif mode == 'Progression-Free':
                mode = 'PFI'
            elif mode == 'Disease-Specific':
                mode = 'DSS'
            print('~~~~~~~~~~~~')
            resp = json.loads(subprocess.check_output(
                ['python', path + 'call_two_gene.py', category1, category2, mode, gene1, gene2, cancer_type, group1, group2, time]).decode('utf-8'))
            # jand 因為可能有 group 沒資料的 warning
            if resp['status'] == 'SUCCESS':
                resp_message = {
                    "chart_data": resp["chart_data"]
                }
            elif resp['status'] == 'WARNING':
                resp_status = 'WARNING'
                resp_message = resp["message"]

        except:
            resp_status = 'FAILED'
            resp_message = traceback.format_exc()

            print(resp_message)
        if resp_status == "SUCCESS":
            resp_status = status.HTTP_200_OK
        elif resp_status == "WARNING":
            resp_status = status.HTTP_400_BAD_REQUEST
        else:
            resp_status = status.HTTP_500_INTERNAL_SERVER_ERROR
            
        return Response(json.dumps(resp_message),
                        status=resp_status)


class TwoGeneDownloadView(APIView):
    def get(self, request, *args, **kwargs):
        category1 = request.GET['category1']
        category2 = request.GET['category2']
        mode = request.GET['mode']
        gene1 = request.GET['gene1']
        gene2 = request.GET['gene2']
        cancer_type = request.GET['type']
        group1 = request.GET['group1']
        group2 = request.GET['group2']



        download_dir = 'download' + os.sep
        if not os.path.exists(download_dir):
            os.makedirs(download_dir)

        if mode == 'Overall':
            mode = 'OS'
        elif mode == 'Disease-Free':
            mode = 'DFI'
        elif mode == 'Progression-Free':
            mode = 'PFI'
        elif mode == 'Disease-Specific':
            mode = 'DSS'

        two_gene = TwoGene()
        data = two_gene.get_download_data(
            category1, category2, mode, gene1, gene2, cancer_type, group1, group2)
        if gene1.find("|") != -1:
            gene1 = gene1.split("|")[0]
        elif gene1.find(",") != -1:
            gene1 = gene1.split(",")[0]

        if gene2.find("|") != -1:
            gene2 = gene2.split("|")[0]
        elif gene2.find(",") != -1:
            gene2 = gene2.split(",")[0]
        data.to_csv(download_dir + mode+"_"+gene1+"_"+gene2+"_"+"logrank_two_gene.csv",
                    index=False, encoding='utf-8')

        with open(download_dir + mode+"_"+gene1+"_"+gene2+"_"+"logrank_two_gene.csv", 'rb') as fh:
            response = HttpResponse(
                fh.read(), content_type="application/vnd.ms-excel")
            response['Content-Disposition'] = 'inline; filename=' + \
                os.path.basename(download_dir + mode+"_"+gene1+"_"+gene2+"_"+"logrank_two_gene.csv")
            os.remove(download_dir + fname)
            return response


class CoxTwoGeneView(APIView):
    def get(self, request, *args, **kwargs):
        result = {
            "status": "success"
        }

        try:
            category1 = request.GET['category1']
            category2 = request.GET['category2']
            cancer_type = request.GET['type']
            gene1 = request.GET['gene1']
            gene2 = request.GET['gene2']
            tab = request.GET.get('tab', "cox")

            two_gene = CoxAftTwoGene()
            if tab == 'aft':
                data = {
                    "d": two_gene.get_aft_data(category1, category2, gene1, gene2, cancer_type),
                    "total": 4
                }
            else:
                data = {
                    "d": two_gene.get_cox_data(category1, category2, gene1, gene2, cancer_type),
                    "total": 4
                }
            result["data"] = data
        except Exception as e:
            result["status"] = "error"
            result["message"] = str(e)

        return JsonResponse(result)


class CoxTwoGeneImgView(APIView):
    def post(self, request, *args, **kwargs):
        result = {
            "status": "success"
        }

        try:
            category1 = request.POST['category1']
            category2 = request.POST['category2']
            cancer_type = request.POST['type']
            gene1 = request.POST['gene1']
            gene2 = request.POST['gene2']
            mode = request.POST['mode']
            tab = request.POST['tab']
            drop_image_columns = request.POST.getlist('drop_image_columns[]')

            if mode == 'Overall':
                mode = 'OS'
            elif mode == 'Disease-Free':
                mode = 'DFI'
            elif mode == 'Progression-Free':
                mode = 'PFI'
            elif mode == 'Disease-Specific':
                mode = 'DSS'

            two_gene = CoxAftTwoGene()
            data = {}
            if tab == "cox":
                tmp = two_gene.get_cox_img(
                    mode, category1, category2, gene1, gene2, cancer_type, drop_image_columns)
                data["img"] = tmp[0]
                data["summary"] = tmp[1]
                data["test_summary"] = tmp[2]
            elif tab == "aft":
                tmp = two_gene.get_aft_img(
                    mode, category1, category2, gene1, gene2, cancer_type, drop_image_columns)
                data["img"] = tmp[0]
                data["summary"] = (tmp[1])
            else:
                data["img"] = ""
                data["summary"] = []
            result["data"] = data
        except Exception as e:
            result["status"] = "error"
            result["message"] = str(e)

        return JsonResponse(result)

class CoxTwoGeneUploadView(APIView):
    def post(self, request, *args, **kwargs):
        result = {
            "status": "success"
        }

        # create folder if not exist
        folder = 'uploads'
        if not os.path.isdir(folder):
            os.mkdir(folder)
        fname = ""

        try:
            upload_file = request.FILES['upload_file']
            category1 = request.POST['category1']
            category2 = request.POST['category2']
            cancer_type = request.POST['type']
            gene1 = request.POST['gene1']
            gene2 = request.POST['gene2']
            mode = request.POST['mode']
            tab = request.POST['tab']

            if upload_file.size > (1000 * 1024):
                raise Exception("File too large")

            fss = FileSystemStorage()
            fname = str(datetime.datetime.now().strftime('%Y%m%d%H%M%S')) + "_" + upload_file.name
            file = fss.save(folder + "/" + fname, upload_file)

            if mode == 'Overall':
                mode = 'OS'
            elif mode == 'Disease-Free':
                mode = 'DFI'
            elif mode == 'Progression-Free':
                mode = 'PFI'
            elif mode == 'Disease-Specific':
                mode = 'DSS'

            two_gene = CoxAftTwoGene()
            data = {}
            if tab == "cox":
                tmp = two_gene.get_cox_upload_img(
                    mode, category1, category2, gene1, gene2, cancer_type, folder + "/" + fname)
                data["img"] = tmp[0]
                data["summary"] = tmp[1]
                data["test_summary"] = tmp[2]
            elif tab == "aft":
                tmp = two_gene.get_aft_upload_img(
                    mode, category1, category2, gene1, gene2, cancer_type, folder + "/" + fname)
                data["img"] = tmp[0]
                data["summary"] = (tmp[1])
            else:
                data["img"] = ""
                data["summary"] = []
            result["data"] = data
        except Exception as e:
            result["status"] = "error"
            result["message"] = str(e)

        # remove not used file
        if fname != "" and os.path.exists(folder + "/" + fname):
            os.remove(folder + "/" + fname)

        return JsonResponse(result)

class CoxTwoGeneDownloadView(APIView):
    def get(self, request, *args, **kwargs):
        category1 = request.GET['category1']
        category2 = request.GET['category2']
        cancer_type = request.GET['type']
        gene1 = request.GET['gene1']
        gene2 = request.GET['gene2']
        mode = request.GET['mode']
        tab = request.GET['tab']


        download_dir = 'download' + os.sep
        if not os.path.exists(download_dir):
            os.makedirs(download_dir)

        if mode == 'Overall':
            mode = 'OS'
        elif mode == 'Disease-Free':
            mode = 'DFI'
        elif mode == 'Progression-Free':
            mode = 'PFI'
        elif mode == 'Disease-Specific':
            mode = 'DSS'

        two_gene = CoxAftTwoGene()
        if tab == "cox":
            data = two_gene.get_cox_download_data(
                mode, category1, category2, gene1, gene2, cancer_type)
        elif tab == "aft":
            data = two_gene.get_aft_download_data(
                mode, category1, category2, gene1, gene2, cancer_type)
        if gene1.find("|") != -1:
            gene1 = gene1.split("|")[0]
        elif gene1.find(",") != -1:
            gene1 = gene1.split(",")[0]

        if gene2.find("|") != -1:
            gene2 = gene2.split("|")[0]
        elif gene2.find(",") != -1:
            gene2 = gene2.split(",")[0]
        data.to_csv(download_dir + mode+"_"+gene1+"_"+gene2+"_"+"_two_gene_clinical.csv",
                    index=False, encoding='utf-8')

        with open(download_dir + mode+"_"+gene1+"_"+gene2+"_"+"_two_gene_clinical.csv", 'rb') as fh:
            response = HttpResponse(
                fh.read(), content_type="application/vnd.ms-excel")
            response['Content-Disposition'] = 'inline; filename=' + \
                os.path.basename(download_dir + mode+"_"+gene1+"_"+gene2+"_"+"_two_gene_clinical.csv")
            os.remove(download_dir + fname)
            return response


class MoreGeneView(APIView):
    def post(self, request, *args, **kwargs):
        result = {
            "status": "success"
        }

        try:
            cancer_type = request.POST['type']
            tab = request.POST['tab']
            gene_mrnas = request.POST.getlist('gene_mrnas[]')
            gene_mirnas = request.POST.getlist('gene_mirnas[]')
            gene_lncrnas = request.POST.getlist('gene_lncrnas[]')

            if len(gene_mrnas) == 0 and len(gene_mirnas) == 0 and len(gene_lncrnas) == 0:
                raise Exception("No genes value")
            print(cancer_type, tab, gene_mrnas, gene_mirnas, gene_lncrnas)

            more_gene = MoreGene()
            data = {}
            if tab == "aft":
                data = {
                    "d": more_gene.get_aft_data(cancer_type, gene_mrnas, gene_mirnas, gene_lncrnas),
                    "total": 4
                }
            else:
                data = {
                    "d": more_gene.get_cox_data(cancer_type, gene_mrnas, gene_mirnas, gene_lncrnas),
                    "total": 4
                }
            result["data"] = data
        except Exception as e:
            result["status"] = "error"
            result["message"] = str(e)

        return JsonResponse(result)

class MoreGeneImgView(APIView):
    def post(self, request, *args, **kwargs):
        result = {
            "status": "success"
        }

        try:
            cancer_type = request.POST['type']
            tab = request.POST['tab']
            gene_mrnas = request.POST.getlist('gene_mrnas[]')
            gene_mirnas = request.POST.getlist('gene_mirnas[]')
            gene_lncrnas = request.POST.getlist('gene_lncrnas[]')
            mode = request.POST['mode']
            drop_image_columns = request.POST.getlist('drop_image_columns[]')

            if len(gene_mrnas) == 0 and len(gene_mirnas) == 0 and len(gene_lncrnas) == 0:
                raise Exception("No genes value")
            print(cancer_type, tab, gene_mrnas, gene_mirnas, gene_lncrnas)

            data = {}
            more_gene = MoreGene()
            if tab == "aft":
                tmp_data = more_gene.get_aft_img_data(cancer_type, mode, gene_mrnas, gene_mirnas, gene_lncrnas, drop_image_columns)
                data["img"] = tmp_data[0]
                data["summary"] = tmp_data[1]
            else:
                tmp_data = more_gene.get_cox_img_data(cancer_type, mode, gene_mrnas, gene_mirnas, gene_lncrnas, drop_image_columns)
                data["img"] = tmp_data[0]
                data["summary"] = tmp_data[1]
                data["test_summary"] = tmp_data[2]

            result["data"] = data
        except Exception as e:
            result["status"] = "error"
            result["message"] = str(e)

        return JsonResponse(result)

class MoreGeneUploadView(APIView):
    def post(self, request, *args, **kwargs):
        result = {
            "status": "success"
        }

        # create folder if not exist
        folder = 'uploads'
        if not os.path.isdir(folder):
            os.mkdir(folder)
        fname = ""

        try:
            upload_file = request.FILES['upload_file']
            cancer_type = request.POST['type']
            tab = request.POST['tab']
            gene_mrnas = request.POST.getlist('gene_mrnas[]')
            gene_mirnas = request.POST.getlist('gene_mirnas[]')
            gene_lncrnas = request.POST.getlist('gene_lncrnas[]')
            mode = request.POST['mode']

            if len(gene_mrnas) == 0 and len(gene_mirnas) == 0 and len(gene_lncrnas) == 0:
                raise Exception("No genes value")
            print(cancer_type, tab, gene_mrnas, gene_mirnas, gene_lncrnas)

            if upload_file.size > (1000 * 1024):
                raise Exception("File too large")

            fss = FileSystemStorage()
            fname = str(datetime.datetime.now().strftime('%Y%m%d%H%M%S')) + "_" + upload_file.name
            file = fss.save(folder + "/" + fname, upload_file)

            more_gene = MoreGene()
            data = {}
            if tab == "aft":
                tmp_data = more_gene.get_aft_upload_img_data(cancer_type, mode, gene_mrnas, gene_mirnas, gene_lncrnas, folder + "/" + fname)
                data["img"] = tmp_data[0]
                data["summary"] = tmp_data[1]
            else:
                tmp_data = more_gene.get_cox_upload_img_data(cancer_type, mode, gene_mrnas, gene_mirnas, gene_lncrnas, folder + "/" + fname)
                data["img"] = tmp_data[0]
                data["summary"] = tmp_data[1]
                data["test_summary"] = tmp_data[2]
            result["data"] = data
        except Exception as e:
            result["status"] = "error"
            result["message"] = str(e)

        # remove not used file
        if fname != "" and os.path.exists(folder + "/" + fname):
            os.remove(folder + "/" + fname)

        return JsonResponse(result)

class MoreGeneDownloadView(APIView):
    def post(self, request, *args, **kwargs):
        result = {
            "status": "success"
        }

        cancer_type = request.POST['type']
        tab = request.POST['tab']
        gene_mrnas = request.POST.getlist('gene_mrnas[]')
        gene_mirnas = request.POST.getlist('gene_mirnas[]')
        gene_lncrnas = request.POST.getlist('gene_lncrnas[]')
        mode = request.POST['mode']

        if len(gene_mrnas) == 0 and len(gene_mirnas) == 0 and len(gene_lncrnas) == 0:
            raise Exception("No genes value")
        print(cancer_type, tab, gene_mrnas, gene_mirnas, gene_lncrnas)

        download_dir = 'download' + os.sep
        if not os.path.exists(download_dir):
            os.makedirs(download_dir)

        more_gene = MoreGene()
        data = more_gene.get_download_data(cancer_type, mode, gene_mrnas, gene_mirnas, gene_lncrnas)

        data.to_csv(download_dir + "more_gene.csv",
                    index=False, encoding='utf-8')

        with open(download_dir + "more_gene.csv", 'rb') as fh:
            response = HttpResponse(
                fh.read(), content_type="application/vnd.ms-excel")
            response['Content-Disposition'] = 'inline; filename=' + \
                os.path.basename(download_dir + "more_gene.csv")
            os.remove(download_dir + fname)
            return response

class LogrankNameView(APIView):
    def get(self, request, *args, **kwargs):
        name = request.GET.get('name', "")
        category = request.GET.get('category', "")
        limit = request.GET.get('limit', 10)
        clean_gene = request.GET.get('clean_gene', "1") # whether clean gene name

        if name == "":
            return JsonResponse([])

        tmp_data = (LogrankDataModel.get(name, category, limit))

        # remove duplicate data
        duplicates = []
        data = []
        for d in tmp_data:
            if "gene_symbol" in d:
                feature = d["gene_symbol"]
            else:
                feature = d["MetaFeature"]

            if clean_gene == "1":
                if feature.find("|") != -1:
                    feature = feature[:feature.find("|")]
                elif feature.find(",") != -1:
                    feature = feature[:feature.find(",")]
                elif feature.find(";") != -1:
                    feature = feature[:feature.find(";")]

            if feature in duplicates:
                continue

            data.append(feature)
            duplicates.append(feature)

        result = {
            "status": "success",
            "data": data
        }
        return JsonResponse(result)


class GeneNameView(APIView):
    def get(self, request, *args, **kwargs):
        category = request.GET['category']
        name = request.GET.get('name', "")
        limit = request.GET.get('limit', 10)
        clean_gene = request.GET.get('clean_gene', "0") # whether clean gene name

        if category == "" or name == "":
            return JsonResponse([])
        tmp_data = list(GenomeDataModel.get(category, name, limit))
        data = []
        for i, d in enumerate(tmp_data):
            new_d = d
            if clean_gene == "1":
                if new_d.find("|") != -1:
                    new_d = new_d[:new_d.find("|")]
                elif new_d.find(",") != -1:
                    new_d = new_d[:new_d.find(",")]
                elif new_d.find(";") != -1:
                    new_d = new_d[:new_d.find(";")]
            if new_d == "?":
                continue
            data.append(new_d)

        result = {
            "status": "success",
            "data": data
        }
        return JsonResponse(result)


class CustomFormat():

    def format_val(data, key):
        val = ""

        if key in data:
            val = data[key]
            if pd.isna(val) or val == 'NA':
                val = ""

            try:
                val = float(val)
                val = format(val, ".2E")

            except Exception as e:
                print(e)

        return val


class GetCategory(APIView):
    def get(self, request, *args, **kwargs):
        name = request.GET.get('name', "")
        if name == "":
            return JsonResponse([])

        result = {
            "status": "success",
            "data": GenomeDataModel.get_category(name)
        }
        return JsonResponse(result)


def index(request):
    return render(request, 'index.html', {
        "path_info": request.META['PATH_INFO']
    })


def tab1(request):
    return render(request, 'tab1.html', {
        "category": request.GET['category'],
        "path_info": request.META['PATH_INFO']
    })


def tab2(request):
    return render(request, 'tab2.html', {
        "category1": request.GET['category1'],
        "category2": request.GET['category2'],
        "path_info": request.META['PATH_INFO']
    })


def browse(request):
    return render(request, 'browse.html', {
        "category": request.GET['category'],
        "path_info": request.META['PATH_INFO']
    })


def gene(request):
    return render(request, 'gene.html', {
        "path_info": request.META['PATH_INFO']
    })

def more_gene(request):
    return render(request, 'more_gene.html', {
        "path_info": request.META['PATH_INFO']
    })

def tutorial(request):
    return render(request, 'tutorial.html', {
        "path_info": request.META['PATH_INFO']
    })


def statistics(request):
    category = request.GET.get('category', "")
    if category in ["protein", "mirna", "mrna", "lncrna", "methylation27k", "methylation450k"]:
        return render(request, 'statistics/' + category + '.html', {
            "path_info": request.META['PATH_INFO']
        })
    else:
        return render(request, 'statistics/all.html', {
            "path_info": request.META['PATH_INFO']
        })


def faq(request):
    return render(request, 'faq.html', {
        "path_info": request.META['PATH_INFO']
    })
