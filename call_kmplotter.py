import sys
import traceback
import pandas as pd
import json
import plotly as py
from python_nctu_cancer.Kmplotter import Kmplotter

if __name__ == '__main__':
    response = {'status': 'success'}
    try:
        category = sys.argv[1]
        cancer_type = sys.argv[2]
        meta_feature = sys.argv[3]
        mode = sys.argv[4]
        time = sys.argv[5]
        L_per = sys.argv[6]
        H_per = sys.argv[7]

        kmplotter = Kmplotter()
        response["data"] = kmplotter.get(category, cancer_type, meta_feature, mode, time, L_per, H_per)
    except Exception as err:
        response['status'] = 'error'
        response['message'] = str(err)

    print(json.dumps(response, cls = py.utils.PlotlyJSONEncoder))
