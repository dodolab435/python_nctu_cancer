
from datetime import datetime

from django.conf import settings
from django.shortcuts import render
from django.http import HttpResponse
from django.http.response import JsonResponse
from django.core.files.storage import FileSystemStorage

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response


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

import os
import re
import csv
import json
import datetime
import traceback
import subprocess
import numpy as np
import pandas as pd
import plotly as py

import plotly.io as pio

import multiprocessing

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
        print(tmp_list)
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


def mp_get_log_rank_pval(queue, new_df, exp_col, status_col, day_col, time, temp_L_per, temp_H_per):
    
    # multiprocessing process get log rank p-value
    kmplotter = Kmplotter()
    new_df = kmplotter.seperate_group(new_df, exp_col, status_col, day_col, "groups", time, temp_L_per, temp_H_per)
    pval = kmplotter.log_rank(new_df, status_col, day_col)
    print("Pval %s" % pval)
    queue.put([float(pval), int(temp_L_per), int(temp_H_per)])

def mp_get_logrank_beast_hper_lper(df, exp_col, status_col, day_col, time):
    jobs = []
    queue = multiprocessing.Queue()
    for i in range(5, 100, 5):
        temp_H_per = str(i)
        temp_L_per = str(100 - i)
        p = multiprocessing.Process(target=mp_get_log_rank_pval, args=(queue, df, exp_col, status_col, day_col, time, temp_L_per, temp_H_per))
        jobs.append(p)
        p.start()
    
    # 等待所有進程完成
    for job in jobs:
        job.join()

    # 從 queue 中獲取進程返回的值
    best_p_val = 1
    while not queue.empty():
        result = queue.get()
        if float(result[0]) < best_p_val:
            best_p_val = float(result[0])
            L_per = str(result[1])
            H_per = str(result[2])
    return L_per, H_per

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

            print(cancer_category, cancer_type, meta_feature, mode, time, L_per, H_per)

            if mode == 'Overall':
                mode = 'OS'
            elif mode == 'Disease-Free':
                mode = 'DFI'
            elif mode == 'Progression-Free':
                mode = 'PFI'
            elif mode == 'Disease-Specific':
                mode = 'DSS'

            mode = mode.upper()
            exp_col = 'Expression'
            status_col = mode
            day_col = mode + '.time'
            
            # 因為直接Kmplotter()時會問題，所以改用subprocess處理
            path = os.path.abspath(os.path.dirname(__name__)) + os.sep
            
            # auto select cutoff
            kmplotter = Kmplotter()
            if H_per == "" and L_per == "":
                new_df = kmplotter.get_logrank_data(cancer_category, cancer_type, meta_feature, mode)
                
                L_per, H_per = mp_get_logrank_beast_hper_lper(new_df, exp_col, status_col, day_col, time)
                
            if L_per == "":
                L_per = "0"
            if H_per == "":
                H_per = "0"
            
            resp = kmplotter.get(cancer_category, cancer_type, meta_feature, mode, time, L_per, H_per)
            # print(resp)
            # resp = json.loads(subprocess.check_output(['python', path + 'call_kmplotter.py', cancer_category, cancer_type, meta_feature, mode, time, L_per, H_per]).decode('utf-8'))
            
            chart_data = json.loads(json.dumps(resp["chart_data"], cls = py.utils.PlotlyJSONEncoder))
            
            resp_message["data"] = {
                'chart_data': chart_data,
                'H_per': H_per,
                'L_per': L_per,
                }

        except Exception as e:
            print(traceback.format_exc())
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
            result["data"] = new_aft.get_aft_cox_img_data(tab, cancer_category, type, feature, cgcite, survival_type, drop_image_columns)
            print(result["data"]["data columns"])
        except Exception as e:
            print(traceback.format_exc())
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
              meta_feature, cgcite, survival_type)

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
            os.remove(download_dir + gene +"_"+survival_type+"_clnical.csv")
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
            print("category1 %s, category2 %s, cancer_type %s, gene1 %s, gene2 %s, group1 %s, group1 %s"\
                % (category1, category2, cancer_type, gene1, gene2, group1, group2))
            kmplotter = Kmplotter()
            data = {
                "d": kmplotter.get_two_gene_data(category1, category2, gene1, gene2, cancer_type, group1, group2),
                "total": 4
            }
            result["data"] = data
        except Exception as e:
            print(traceback.format_exc())
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
            group1 = request.GET['group1'].split(",")
            group2 = request.GET['group2'].split(",")
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
            kmplotter = Kmplotter()
            resp = kmplotter.get_two_gene_img_data(category1, category2, mode, gene1, gene2, cancer_type, group1, group2, time)
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
        group1 = request.GET['group1'].split(",")
        group2 = request.GET['group2'].split(",")



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

        kmplotter = Kmplotter()
        data = kmplotter.get_download_two_gene_data(category1, category2, mode, gene1, gene2, cancer_type, group1, group2)
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
            os.remove(download_dir + mode+"_"+gene1+"_"+gene2+"_"+"logrank_two_gene.csv")
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

            newaft = NewAft()
            data = {
                "d": newaft.get_two_gene_data(tab, category1, category2, gene1, gene2, cancer_type),
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
            
            newaft = NewAft()
            result["data"] = newaft.get_two_gene_img_data(
                tab, 
                mode, 
                category1, 
                category2, 
                gene1, 
                gene2, 
                cancer_type, 
                drop_image_columns
            )
        except Exception as e:
            print(traceback.format_exc())
            result["status"] = "error"
            result["message"] = str(e)

        return JsonResponse(result)

# class CoxTwoGeneUploadView(APIView):
#     def post(self, request, *args, **kwargs):
#         result = {
#             "status": "success"
#         }

#         # create folder if not exist
#         folder = 'uploads'
#         if not os.path.isdir(folder):
#             os.mkdir(folder)
#         fname = ""

#         try:
#             upload_file = request.FILES['upload_file']
#             category1 = request.POST['category1']
#             category2 = request.POST['category2']
#             cancer_type = request.POST['type']
#             gene1 = request.POST['gene1']
#             gene2 = request.POST['gene2']
#             mode = request.POST['mode']
#             tab = request.POST['tab']

#             if upload_file.size > (1000 * 1024):
#                 raise Exception("File too large")

#             fss = FileSystemStorage()
#             fname = str(datetime.datetime.now().strftime('%Y%m%d%H%M%S')) + "_" + upload_file.name
#             file = fss.save(folder + "/" + fname, upload_file)

#             if mode == 'Overall':
#                 mode = 'OS'
#             elif mode == 'Disease-Free':
#                 mode = 'DFI'
#             elif mode == 'Progression-Free':
#                 mode = 'PFI'
#             elif mode == 'Disease-Specific':
#                 mode = 'DSS'

#             two_gene = CoxAftTwoGene()
#             data = {}
#             if tab == "cox":
#                 tmp = two_gene.get_cox_upload_img(
#                     mode, category1, category2, gene1, gene2, cancer_type, folder + "/" + fname)
#                 data["img"] = tmp[0]
#                 data["summary"] = tmp[1]
#                 data["test_summary"] = tmp[2]
#             elif tab == "aft":
#                 tmp = two_gene.get_aft_upload_img(
#                     mode, category1, category2, gene1, gene2, cancer_type, folder + "/" + fname)
#                 data["img"] = tmp[0]
#                 data["summary"] = (tmp[1])
#             else:
#                 data["img"] = ""
#                 data["summary"] = []
#             result["data"] = data
#         except Exception as e:
#             result["status"] = "error"
#             result["message"] = str(e)

#         # remove not used file
#         if fname != "" and os.path.exists(folder + "/" + fname):
#             os.remove(folder + "/" + fname)

#         return JsonResponse(result)

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

        newaft = NewAft()
        data = newaft.get_two_gene_download_data(
            mode, 
            category1, 
            category2, 
            gene1, 
            gene2, 
            cancer_type
        )
        
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
            os.remove(download_dir + mode+"_"+gene1+"_"+gene2+"_"+"_two_gene_clinical.csv")
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

            data = {}
            newaft = NewAft()
            data = {
                    "d": newaft.get_more_gene_data(
                        tab,
                        cancer_type, 
                        gene_mrnas, 
                        gene_mirnas, 
                        gene_lncrnas
                        ),
                    "total": 4
                }
            result["data"] = data
        except Exception as e:
            print(traceback.format_exc())
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
            
            newaft = NewAft()
            result["data"] = newaft.get_more_gene_img_data(tab, cancer_type, mode, gene_mrnas, gene_mirnas, gene_lncrnas, drop_image_columns)

        except Exception as e:
            print(traceback.format_exc())
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

        newaft = NewAft()
        data = newaft.get_more_gene_download_data(cancer_type, mode, gene_mrnas, gene_mirnas, gene_lncrnas)

        data.to_csv(download_dir + "more_gene.csv",
                    index=False, encoding='utf-8')

        with open(download_dir + "more_gene.csv", 'rb') as fh:
            response = HttpResponse(
                fh.read(), content_type="application/vnd.ms-excel")
            response['Content-Disposition'] = 'inline; filename=' + \
                os.path.basename(download_dir + "more_gene.csv")
            os.remove(download_dir + "more_gene.csv")
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

from io import BytesIO

class UpLoadSurvivalChartView(APIView):
    def post(self, request, *args, **kwargs):
        result = {
            'status' : 'success'
        }
        try:
            day_col = request.POST.get("day_col")
            status_col = request.POST.get("status_col")
            # expression_col_list = request.POST.getlist("expression_col_list")
            expression_col = request.POST.get("gene_expression_col")
            time = request.POST.get('time', "0")
            L_per = request.POST.get('L_per', "0")
            H_per = request.POST.get('H_per', "0")
            print(day_col, status_col, expression_col, time, L_per, H_per)
            file = request.FILES.get("file")
            df = pd.read_csv(BytesIO(file.read()))[[expression_col, day_col, status_col]]
        
            # auto select cutoff
            if H_per == "" and L_per == "":
                L_per, H_per = mp_get_logrank_beast_hper_lper(df, expression_col, status_col, day_col, time)
                
            if L_per == "":
                L_per = "0"
            if H_per == "":
                H_per = "0"

            kmplotter = Kmplotter()
            resp = kmplotter.get_mkpolt(df, expression_col, status_col, day_col, time, L_per, H_per)
            
            if resp["status"] != 'success':
                raise Exception("A column with a continuous variable is expected.\nError: " + resp["message"])
            
            result["data"] = {
                'chart_data': resp["chart_data"],
                'H_per': H_per,
                'L_per': L_per,
                }
        except ValueError as e:
            result["status"] = "error"
            result["message"] = "A column with a continuous variable is expected.\nError: " + str(e)
        except Exception as e:
            result["status"] = "error"
            result["message"] = "Please confirm if the uploaded data is correct and select the appropriate columns.\n" + type(e).__name__  + ":" + str(e)
            
        return JsonResponse(result, safe=False)

import math
import base64

from lifelines import CoxPHFitter
from matplotlib import pyplot as plt
from lifelines.statistics import proportional_hazard_test


class UpLoadSurvivalCoxView(APIView):
    def post(self, request, *args, **kwargs):
        result = {
            'status' : 'success'
        }
        try:
            day_col = request.POST.get("day_col")
            status_col = request.POST.get("status_col")
            expression_col_list = request.POST.getlist("expression_col_list")
            expression_col_class_list = request.POST.getlist("expression_col_class_list")
            expression_col_base_list = request.POST.getlist("expression_col_base_list")
            
            # drop_image_columns = request.POST.getlist("drop_image_columns")
            
            print(day_col, status_col, expression_col_list, expression_col_class_list, expression_col_base_list)
            file = request.FILES.get("file")
            
            
            select_col = expression_col_list.copy()
            expression_col_class_list.append("value")
            select_col.append(day_col)
            expression_col_class_list.append("value")
            select_col.append(status_col)
            
            df = pd.read_csv(BytesIO(file.read()))[select_col]
            for i in range(len(select_col)):
                col_exp = select_col[i]
                col_class = expression_col_class_list[i]
                
                if col_class == "continuous":
                    df[col_exp] = pd.to_numeric(df[col_exp])
                elif col_class == "categorical":
                    base_val = expression_col_base_list[i]
                    
                    temp_df = pd.get_dummies(df[col_exp]).apply(pd.to_numeric)
                    
                    temp_col_name = {}
                    for col_name in temp_df.columns:
                        temp_col_name[col_name] = "%s_%s" % (col_exp, col_name)
                    temp_df = temp_df.rename(columns=temp_col_name)
                    temp_df = temp_df.drop("%s_%s" % (col_exp, base_val), axis=1)
                    
                    df = pd.concat([df, temp_df], axis=1)
                    df = df.drop(col_exp, axis=1)
            
            n = len(df)
            plt_title = 'Hazard Ratio Plot (status=%s, day=%s, n=%s)' % (status_col, day_col, n)
            new_aft = NewAft()
            result["data"] = new_aft.aft_cox_img("cox", df, day_col, status_col, plt_title)
            
        except Exception as e:
            result["status"] = "error"
            result["message"] = "Please confirm if the uploaded data is correct and select the appropriate columns.\nError: " + str(e)
        return JsonResponse(result, safe=False)

from lifelines import LogNormalAFTFitter

class UpLoadSurvivalAftView(APIView):
    def post(self, request, *args, **kwargs):
        result = {
            'status' : 'success'
        }
        try:
            day_col = request.POST.get("day_col")
            status_col = request.POST.get("status_col")
            expression_col_list = request.POST.getlist("expression_col_list")
            expression_col_class_list = request.POST.getlist("expression_col_class_list")
            expression_col_base_list = request.POST.getlist("expression_col_base_list")
   
            # drop_image_columns = request.POST.getlist("drop_image_columns")
            
            print(day_col, status_col, expression_col_list, expression_col_class_list, expression_col_base_list)
            file = request.FILES.get("file")
            
            
            select_col = expression_col_list.copy()
            expression_col_class_list.append("value")
            select_col.append(day_col)
            expression_col_class_list.append("value")
            select_col.append(status_col)
            
            df = pd.read_csv(BytesIO(file.read()))[select_col]
            for i in range(len(select_col)):
                col_exp = select_col[i]
                col_class = expression_col_class_list[i]
                
                if col_class == "continuous":
                    df[col_exp] = pd.to_numeric(df[col_exp])
                elif col_class == "categorical":
                    base_val = expression_col_base_list[i]
                    
                    temp_df = pd.get_dummies(df[col_exp]).apply(pd.to_numeric)
                    
                    temp_col_name = {}
                    for col_name in temp_df.columns:
                        temp_col_name[col_name] = "%s_%s" % (col_exp, col_name)
                    temp_df = temp_df.rename(columns=temp_col_name)
                    temp_df = temp_df.drop("%s_%s" % (col_exp, base_val), axis=1)
                    
                    df = pd.concat([df, temp_df], axis=1)
                    df = df.drop(col_exp, axis=1)
            
            n = len(df)
            plt_title = 'Hazard Ratio Plot (status=%s, day=%s, n=%s)' % (status_col, day_col, n)
            new_aft = NewAft()
            result["data"] = new_aft.aft_cox_img("aft", df, day_col, status_col, plt_title)
            
        except Exception as e:
            result["status"] = "error"
            result["message"] = "Please confirm if the uploaded data is correct and select the appropriate columns.\nError: " + str(e)
        return JsonResponse(result)
    
class UpLoadGetColView(APIView):
    def post(self, request, *args, **kwargs):
        result = {
            'status' : 'success'
        }
        try:
            file = request.FILES['file']
            _, extension = os.path.splitext(file.name)
            if extension in [".txt", ".tsv"]:
                df = pd.read_csv(BytesIO(file.read()), sep="\t")
            elif extension == ".csv":
                df = pd.read_csv(BytesIO(file.read()))
            else:
                raise "The file must have a csv, txt, or tsv extension."

            col_list = list(df.columns)
            data = {
                'col': col_list,
            }
            
            for col in col_list:
                data[col] = list(set(df[col].fillna("#NULL").to_list()))
            
            result["data"] = data
        except Exception as e:
            result["status"] = "error"
            result["message"] = str(e)
            
        return JsonResponse(result)
        
def upload_data(request):
    return render(request, 'upload_data.html', {
        "path_info": request.META['PATH_INFO']
    })

class DownloadDemoData(APIView):
    def get(self, request, *args, **kwargs):
        with open("python_nctu_cancer/Supplemental/HNSC_Fibronectin_os_L50_173.csv", 'rb') as fh:
            response = HttpResponse(
                fh.read(), content_type="application/vnd.ms-excel")
            response['Content-Disposition'] = 'inline; filename=' + \
                os.path.basename("python_nctu_cancer/Supplemental/HNSC_Fibronectin_os_L50_173.csv")
            return response
        
class TestView(APIView):
    def post(self, request, *args, **kwargs):
        result = {
            'status' : 'success'
        }
        cancer_type = request.POST.get("cancer_type")
        category = request.POST.get("category")
        gene = request.POST.get("gene")
        result['data'] = NewAft().test(cancer_type, category, gene)
        return JsonResponse(result)