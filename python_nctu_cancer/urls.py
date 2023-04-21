"""new_tacco_life URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.views import static ##新增
from django.conf import settings ##新增
from django.urls import re_path
from django.contrib import admin
from django.urls import include, path

from rest_framework.routers import DefaultRouter

from python_nctu_cancer import views

urlpatterns = [
    path('', views.index, name='index'),
    path('tab1', views.tab1, name='tab1'),
    path('tab2', views.tab2, name='tab2'),
    path('browse', views.browse, name='browse'),
    path('gene', views.gene, name='gene'),
    path('more_gene', views.more_gene, name='more_gene'),
    path('tutorial', views.tutorial, name='tutorial'),
    path('statistics', views.statistics, name='statistics'),
    path('faq', views.faq, name='faq'),
    path('upload_data', views.upload_data, name='upload_data'),
    
    path('api/upload_data_chart', views.UpLoadSurvivalChartView.as_view(), name='upload_data_chart'),
    path('api/upload_data_cox', views.UpLoadSurvivalCoxView.as_view(), name='upload_data_cox'),
    path('api/upload_data_aft', views.UpLoadSurvivalAftView.as_view(), name='upload_data_aft'),
    path('api/upload_data_get_col', views.UpLoadGetColView.as_view(), name='upload_data_get_col'),

    path('admin/', admin.site.urls),
    path('api-auth/', include('rest_framework.urls', namespace='rest_framework')),
    path('api/category', views.CategoryView.as_view(), name='category'),
    path('api/chart', views.ChartView.as_view(), name='chart'),
    path('api/chart/download', views.ChartDownloadView.as_view(), name='chart_download'),
    path('api/correlation', views.CorrelationView.as_view(), name='correlation'),
    path('api/aftplot', views.AftPlotView.as_view(), name='aftplot'),
    path('api/aftplot/download', views.AftPlotDownloadView.as_view(), name='aftplot_download'),
    path('api/aftplot/upload', views.AftPlotUploadView.as_view(), name='aftplot_upload'),
    path('api/boxplot', views.BoxPlotView.as_view(), name='boxplot'),
    path('api/feature', views.FeatureView.as_view(), name='feature'),
    
    path('api/logrank/name', views.LogrankNameView.as_view(), name='logrank_name'),
    path('api/logrank/download', views.LogRankDownloadView.as_view(), name='logrank_download'),
    path('api/logrank', views.LogRankView.as_view(), name='logrank'),
    
    path('api/aftdata', views.AftDataView.as_view(), name='aftdata'),
    path('api/aftdata/download', views.AftDataDownloadView.as_view(), name='aftdata_download'),
    path('api/coxdata', views.CoxDataView.as_view(), name='coxdata'),
    path('api/coxdata/download', views.CoxDataDownloadView.as_view(), name='coxdata_download'),
    path('api/two_gene', views.TwoGeneView.as_view(), name='two_gene'),
    path('api/two_gene/img', views.TwoGeneImgView.as_view(), name='two_gene_img'),
    path('api/two_gene/download', views.TwoGeneDownloadView.as_view(), name='two_gene_download'),
    path('api/cox_two_gene', views.CoxTwoGeneView.as_view(), name='cox_two_gene'),
    path('api/cox_two_gene/img', views.CoxTwoGeneImgView.as_view(), name='cox_two_gene_img'),
    path('api/cox_two_gene/upload', views.CoxTwoGeneUploadView.as_view(), name='cox_two_gene_upload'),
    path('api/cox_two_gene/download', views.CoxTwoGeneDownloadView.as_view(), name='cox_two_gene_download'),
    path('api/gene/name', views.GeneNameView.as_view(), name='gene_name'),
    path('api/more_gene', views.MoreGeneView.as_view(), name='more_gene'),
    path('api/more_gene/img', views.MoreGeneImgView.as_view(), name='more_gene_img'),
    path('api/more_gene/upload', views.MoreGeneUploadView.as_view(), name='more_gene_upload'),
    path('api/more_gene/download', views.MoreGeneDownloadView.as_view(), name='more_gene_download'),
    path('api/get_category', views.GetCategory.as_view(), name='get_category'),
    
    path('api/test', views.TestView.as_view(), name='api_test'),
    
    re_path(r'^static/(?P<path>.*)$', static.serve,
      {'document_root': settings.STATIC_ROOT}, name='static'),
]
