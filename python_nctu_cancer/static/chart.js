// hide chart
$('.shiny-plot-output').hide();

$("#nav-gene").on("click", function () {
    $('.shiny-plot-output').hide();
});

$("[name='chart_height'], [name='chart_width']").on("change", function () {
    if (! $('#chart-option').is(':hidden') || ! $('#chart-option-browse-modal').is(':hidden')){
        showChart();
    }else if (! $('#chart').is(':hidden') || ! $('#chart-browse-modal').is(':hidden')){
        boxPlot();
    }
});

// change chart width or color
$('.chart-option-color1, .chart-option-width1, .chart-option-color2, .chart-option-width2, .chart-option-marker-color1, .chart-option-marker-color2').on("change", function () {
    if (MY_DATA.chartJsonResult["chart_data"] && MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"]) {
        showChart();
    }
});

function downloadChart(category, type, feature, mode, L_per, H_per) {
    window.open(rootUrl + '/api/chart/download?category=' + category + '&type=' + type + '&feature=' + feature + '&mode=' + mode + '&L_per=' + L_per + '&H_per=' + H_per);
}

function downloadAftPlot(category, type, feature, cgcite, survivalType) {
    window.open(rootUrl + '/api/aftplot/download?category=' + category + '&type=' + type + '&feature=' + feature + '&cgcite=' + cgcite + '&survival_type=' + survivalType);
}

function downloadPdf(isModal) {
    if (! $('#chart').is(':hidden') || (! $('#chart-browse-modal').is(':hidden') && $('#chart-browse-modal').length)){
        if (isModal) {
            chartDivId = "chart-browse-modal";
            $chart = $("#chart-browse-modal");
            
        }else{
            chartDivId = "chart";
            $chart = $("#chart");
        }
        // 應該要讓他輸入大小
        Plotly.toImage(chartDivId, {format: "png", width: $chart.width(), height: $chart.height(), scale: 4}).then(function(png) {
            // create a jsPDF object
            var doc = new jsPDF({
                dpi: 3000
            });
        
            // add the PNG image to the PDF document using addImage() method
            doc.addImage(png, 'PNG', 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getWidth() * (parseInt($chart.height()) / parseInt($chart.width())));
        
            // save the PDF document
            doc.save('myPDF.pdf');
        });
    }else {
        if (isModal) {
            $chart = $("#chart-cox-modal .aftImg");
        }else{
            $chart = $("#chart-cox .aftImg");
        }
        var doc = new jsPDF({
            dpi: 300
        });

        // Add the image to the PDF document
        doc.addImage($chart.attr("src"), "JPEG", 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getWidth() * (parseInt($chart.height()) / parseInt($chart.width())));

        // Save the PDF document
        doc.save("myPDF.pdf");
    }
};

function drawChart(mode, category, isModal) {
    var L_per, H_per;
    if ($(".chart-option-cutoff").val() == "Auto"){
        if (isModal) {
            $('#chart-modal-LP').val("");
            $('#chart-modal-HP').val("");
        } else {
            $('#chart-LP').val("");
            $('#chart-HP').val("");
        }
    }
    if (isModal) {
        L_per = $('#chart-modal-LP').val();
        H_per = $('#chart-modal-HP').val();
        time = $('#chart-modal-time').val();
    } else {
        L_per = $('#chart-LP').val();
        H_per = $('#chart-HP').val();
        time = $('#chart-time').val();
    }
    
    console.log("mode: " + mode, 
                "category: " + category, 
                "time: " + time, 
                "isModal: " + isModal, 
                "H_per: " + H_per, 
                "L_per: " + L_per,
                "MY_DATA", MY_DATA);

    try {
        if (parseInt(L_per) + parseInt(H_per) > 100){
            throw "Numbers should not sum to over 100."
        }
        if (isModal) {
            startModalLoading();
        } else {
            startLoading();
        }

        $.ajax({
            url: rootUrl + '/api/chart?_cache=' + Math.random(),
            type: "GET",
            dataType: "json",
            data: {
                category: category,
                type: MY_DATA.selectedCancerType,
                feature: MY_DATA.selectedMetaFeature,
                mode: mode,
                time: time,
                L_per: L_per,
                H_per: H_per
            },
            complete: function (data, textStatus, jqXHR) {
                if (isModal) {
                    stopModalLoading();
                } else {
                    stopLoading();
                }
            },
            success: function (result, textStatus, jqXHR) {
                if (result.status !== "success") {
                    alert(result.message || 'error');
                    return;
                }
                MY_DATA.chartJsonResult = result['data'];
                MY_DATA.chartCategory = category;
                MY_DATA.selectedSurvivalType = mode;
                if (L_per == "" && H_per == ""){
                    if (isModal) {
                        $('#chart-modal-LP').val(result['data']['L_per']);
                        $('#chart-modal-HP').val(result['data']['H_per']);
                    } else {
                        $('#chart-LP').val(result['data']['L_per']);
                        $('#chart-HP').val(result['data']['H_per']);
                    }
                }
                
                showChart();
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                alert("Error: " + errorThrown + '\n\n'
                    + "Message: " + XMLHttpRequest.responseJSON.replace(/\\n/g, '\n').replace(/\\"/g, '"'));
            }
        });
    } catch (e) {
        if (isModal) {
            stopModalLoading();
        } else {
            stopLoading();
        }
        console.log(e);
        alert(e);
    }
}

function addChartDownloadButton($chart){
    var $download = '<div style="text-align:center; padding-bottom: 40px;"><a href="#" onclick="downloadChart(\'' + MY_DATA.chartCategory + '\', \'' + MY_DATA.selectedCancerType + '\', \'' + MY_DATA.selectedMetaFeature + '\', \'' + MY_DATA.selectedSurvivalType + '\', \'' + MY_DATA.chartJsonResult['L_per'] + '\', \'' + MY_DATA.chartJsonResult['H_per'] + '\')">Download clinical data</a></div>';
    $chart.append($download);
}

function settingChartHeightWidth($chart) {
    $height_width_div = $chart.siblings("div[name='height_width_div']");
    $height_width_div.show();
    $chart_height = $height_width_div.children("input[name='chart_height']");
    $chart_width = $height_width_div.children("input[name='chart_width']");
    if ($chart_height.val() === ""){
        $chart_height.val(parseInt($chart.css("height")));
    } else {
        $chart.css("height", $chart_height.val());
    }
    if ($chart_width.val() === ""){
        $chart_width.val(parseInt($chart.css("width")));
    } else {
        $chart.css("width", $chart_width.val());
    }
}

function showChart() {
    var $chart, $chartOption, divId;
    var chartIndex;
    if ($("#tbl-browse-modal").css('display') != 'none' && $('#tbl-browse-modal').length) {
        divId = 'chart-browse-modal';
        $chart = $('#chart-browse-modal');
        $chartOption = $('#chart-option-browse-modal');
        chartIndex = 1;
    } else {
        divId = 'chart';
        $chart = $('#chart');
        $chartOption = $('#chart-option');
        chartIndex = 0;
    }
    
    settingChartHeightWidth($chart);

    if (MY_DATA.chartJsonResult["chart_data"] && MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"]) {
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][0]["line"]["color"] = $('.chart-option-color1').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][0]["line"]["width"] = $('.chart-option-width1').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][1]["line"]["color"] = $('.chart-option-color1').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][1]["line"]["width"] = $('.chart-option-width1').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][2]["marker"]["color"] = $('.chart-option-marker-color1').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][3]["marker"]["color"] = $('.chart-option-marker-color1').eq(chartIndex).val();
        

        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][4]["line"]["color"] = $('.chart-option-color2').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][4]["line"]["width"] = $('.chart-option-width2').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][5]["line"]["color"] = $('.chart-option-color2').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][5]["line"]["width"] = $('.chart-option-width2').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][6]["marker"]["color"] = $('.chart-option-marker-color2').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][7]["marker"]["color"] = $('.chart-option-marker-color2').eq(chartIndex).val();
    }
    var chart1_data = MY_DATA.chartJsonResult["chart_data"][0].chart1_data;
    var chart_layout = MY_DATA.chartJsonResult["chart_data"][0].layout;

    $chartOption.show();
    $chart.html("").show();
    
    Plotly.newPlot(divId, chart1_data, chart_layout || {});
    if ($('#input-file').length == 0) {
        addChartDownloadButton($chart);
    }
}

/**
 * Show cox or aft image's table
 */
function showImgTable($chart, tab) {
    let htmls = [], tmpKey, key, i, tmpName, tmpVal, j;

    var summaries = [];
    for (key in MY_DATA.chartData["data"]["summary"]) {
        var tmpData = MY_DATA.chartData["data"]["summary"][key];
        tmpData["_gene_name"] = key;
        summaries.push(tmpData);
    }

    htmls.push('<div class="row">');
    htmls.push('<div class="col-sm-7">' + MY_DATA.chartData["data"]["img"]);
    htmls.push('</div>');
    htmls.push('<div class="col-sm-5 img-table-container" style="margin-top: 20px;">');
    if (summaries.length > 0) {
        tmpName = "HR";
        if (tab == "aft") {
            tmpName = "TR";
        }
        htmls.push('<table class="table table-bordered">');
        htmls.push('<tr align="center"><td scope="col"></td><td scope="col">' + tmpName + '</td><td scope="col">Confidence Interval</td>');
        htmls.push('<td scope="col">P-val</td>');
        if (MY_DATA.chartData["data"]["test_summary"]) {
            htmls.push('<td scope="col">PH-assumption</td>');
        }
        htmls.push('</tr>');

        summaries.sort(function(a, b) {
            return parseFloat(a["p"]) - parseFloat(b["p"]);
        });
        
        for (i = 0; i < summaries.length; i ++) {
            tmpKey = summaries[i]["_gene_name"];
            console.log(summaries[i]["exp(coef)"], summaries[i]["exp(coef) lower 95%"], summaries[i]["exp(coef) upper 95%"]);
            
            

            htmls.push('<tr align="center"><td>' + tmpKey + '</td><td>' + summaries[i]["exp(coef)"] + '</td>');
            htmls.push('<td>[' + summaries[i]["exp(coef) lower 95%"] + ', ' + summaries[i]["exp(coef) upper 95%"] + ']</td>');
            if(parseFloat(summaries[i]["p"]) < 0.05) {
                htmls.push('<td style="white-space: nowrap; color: red;">' + summaries[i]["p"] + '</td>');
            }else{
                htmls.push('<td style="white-space: nowrap;">' + summaries[i]["p"] + '</td>');
            }
            if (MY_DATA.chartData["data"]["test_summary"]) {
                tmpVal = "";
                for (j = 0; j < MY_DATA.chartData["data"]["test_summary"]["name"].length; j ++) {
                    if (tmpKey == MY_DATA.chartData["data"]["test_summary"]["name"][j]) {
                        tmpVal = MY_DATA.chartData["data"]["test_summary"]["p_value"][j];
                        try {
                            tmpVal = tmpVal.toFixed(2);
                        } catch (ex) {
                            tmpVal = 0;
                        }
                        if (tmpVal <= 0.05) {
                            tmpVal = '<span style="color: red;">' + tmpVal + '</span>';
                        }
                        break;
                    }
                }
                htmls.push('<td scope="col">' + tmpVal + '</td>');
            }
            htmls.push('</tr>');
        }

        htmls.push('</table>');
    }
    htmls.push('<div>*HR : Hazard ratio, TR : time ratio</div>');
    htmls.push('</div>');
    htmls.push('</div>');
    $chart.show();
    $chart.html(htmls.join(''));
}

function addAftChartDownloadButton($chart, category, type, feature, cgcite, survivalType){
    var $download = '<div style="text-align:center; padding-bottom: 40px;"><a href="#" onclick="downloadAftPlot(\'' + category + '\', \'' + type + '\', \'' + feature + '\', \'' + cgcite + '\', \'' + survivalType + '\')">Download clinical data</a></div>';
    $chart.append($download);
}

function _settingSelectColumns($chartObj) {
    let htmls = [], tmpKeys = [], key, i;

    for (i = 0; i < MY_DATA.chartData["data"]["data columns"].length; i ++) {
        tmpKeys.push(MY_DATA.chartData["data"]["data columns"][i]);
    }
    
    htmls.push('<div>Remove features&emsp;');
    for (i = 0; i < tmpKeys.length; i ++) {
        if (tmpKeys[i] == "Intercept") {
            continue;
        }
        htmls.push('<label><input type="checkbox" name="img_checkbox" value="' + tmpKeys[i] + '" checked="checked" /> ' + tmpKeys[i] + '</label>&emsp;');
    }
    htmls.push('<button class="btn btn-default btn-sm" type="button">Calculate</button>');
    htmls.push('</div>');
    htmls.push('<br>');
    // upload custom excel html
    htmls.push('<div>');
    htmls.push('<input type="file" name="upload_file" class="cox_aft_file" accept=".csv" style="display: none;" />');
    htmls.push('<span class="temp_file_text"></span>');
    // htmls.push('<input type="button" class="select_file" value="Select file" />&emsp;');
    // htmls.push('<input type="button" class="csv_upload" value="Upload & reanalyze" />&emsp;');
    isModal = $("#chart-cox-modal").length && !$("#chart-cox-modal").is(':hidden')
    htmls.push('<input type="button" value="Download PDF" onclick="downloadPdf(' + isModal + ')" />');
    htmls.push('</div>');

    $chartObj.show();
    $chartObj.html(htmls.join(''));
    
    // listening trigger file
    $chartObj.find('.select_file').on('click', function() {
        $chartObj.find('.cox_aft_file').trigger("click");
    });
    $chartObj.find('.cox_aft_file').on('change', function() {
        $chartObj.find('.temp_file_text').html($(this).val());
    });
}

/**
 * Drawing more gene's cox or aft chart
 */
function drawNewAftChart(category, tab, type, feature, cgcite, survivalType, ignore) {
    console.log(category, tab, type, feature, cgcite, survivalType, ignore);
    var $chart, $chart2;
    if (["methylation27k", "methylation450k"].includes(category) && $('#tbl-browse-modal').length) {
        $chart = $('#chart-cox-modal');
        $chart2 = $('#chart2-browse-modal');
        startModalLoading();

    } else {
        $chart = $('#chart-cox');
        $chart2 = $('#chart-cox-option');
        startLoading();
    }

    $.ajax({
        url: rootUrl + '/api/aftplot',
        type: "POST",
        dataType: "json",
        data: {
            category: category,
            tab: tab,
            type: type,
            feature: feature,
            cgcite: cgcite,
            survival_type: survivalType,
            drop_image_columns: MY_DATA.drop_image_columns
        },
        complete: function (data, textStatus, jqXHR) {
            if (["methylation27k", "methylation450k"].includes(category) && $('#tbl-browse-modal').length) {
                stopModalLoading();
            } else {
                stopLoading();
            }
        },
        success: function (result, textStatus, jqXHR) {
            if (result.status == "success") {
                MY_DATA.chartData = result;
                showImgTable($chart, tab);

                if (ignore !== 1) {
                    _showSelectColumns($chart2);
                    if ($('#input-file').length == 0) {
                        addAftChartDownloadButton($chart2, category, type, feature, cgcite, survivalType);
                    }
                }

            } else {
                alert(result.message || "error");
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            alert("Error: " + XMLHttpRequest);
        }
    });

    function _showSelectColumns($chartObj) {
        _settingSelectColumns($chartObj);

        // listening event and redraw table
        $chartObj.find('.btn').on('click', function() {
            MY_DATA.drop_image_columns = [];
            $chartObj.find('[name="img_checkbox"]').each(function() {
                if (!$(this).prop("checked")) {
                    MY_DATA.drop_image_columns.push($(this).val());
                }
            })
    
            drawNewAftChart(category, tab, type, feature, cgcite, survivalType, 1);
        })
    }
}

function drawBoxPlot(gene, category) {

    try {
        if (["methylation27k", "methylation450k"].includes(category)) {
            startModalLoading();
        } else {
            startLoading();
        }

        $.ajax({
            url: rootUrl + '/api/boxplot',
            type: "GET",
            dataType: "json",
            data: {
                category: category,
                gene: gene,
            },
            complete: function (data, textStatus, jqXHR) {
                if (["methylation27k", "methylation450k"].includes(category)) {
                    stopModalLoading();
                } else {
                    stopLoading();
                }
            },
            success: function (result, textStatus, jqXHR) {
                if (result.status == "success") {
                    MY_DATA.chartJsonResult = result['data']["result"];
                    MY_DATA.chartCategory = category;
                    MY_DATA.chartGene = gene;
                    console.log(MY_DATA.chartJsonResult);
                    boxPlot();
                } else {
                    alert(result.message || "error");
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                alert("Error: " + XMLHttpRequest);
            }
        });
    } catch (e) {

    }
}

function boxPlot() {
    
    var x1 = [];
    var x2 = [];
    var trace1_y = [];
    var trace2_y = [];
    var json = MY_DATA.chartJsonResult;
    var category = MY_DATA.chartCategory;
    var gene = MY_DATA.chartGene;

    gene = gene.split("|")[0];
    gene = gene.split(",")[0];

    for (var type in json) {
        var normals = json[type]['normal']
        var tumors = json[type]['tumor']
        for (var i = 0; i < normals.length; i++) {
            x1.push(type);
            trace1_y.push(normals[i]);
        }
        for (var i = 0; i < tumors.length; i++) {
            x2.push(type);
            trace2_y.push(tumors[i]);
        }
    }

    var trace1 = {
        y: trace1_y,
        x: x1,
        name: 'Normal',
        marker: { color: '#3D9970' },
        type: 'box'
    };

    var trace2 = {
        y: trace2_y,
        x: x2,
        name: 'Tumor',
        marker: { color: '#FF4136' },
        type: 'box'
    };

    var data = [trace1, trace2];
    if (category==='protein'){
    var layout = {
        title: gene,
        yaxis: {
            title: 'Log (Normalized Expression value)',
            zeroline: false
        },
        boxmode: 'group'
    };}

    else if (category==='methylation27k' || category==='methylation450k' ){
    var layout = {
        title: gene,
        yaxis: {
            title: 'Log (Beta value)',
            zeroline: false
        },
        boxmode: 'group'
    };}

    else{var layout = {
        title: gene,
        yaxis: {
            title: 'Log (Expression value)',
            zeroline: false
        },
        boxmode: 'group'
    };}

    var $chart, divId;
    if (["methylation27k", "methylation450k"].includes(category)) {
        $chart = $('#chart-browse-modal');
        divId = "chart-browse-modal";
    } else {
        $chart = $('#chart');
        divId = "chart";
    }

    settingChartHeightWidth($chart);

    $chart.html("").show();
    Plotly.newPlot(divId, data, layout);
}

function drawCorrelationChart(data) {
    console.log(data);
    try {
        startModalLoading();

        $.ajax({
            url: rootUrl + '/api/correlation',
            type: "GET",
            dataType: "json",
            data: data,
            complete: function (data, textStatus, jqXHR) {
                stopModalLoading();
            },
            success: function (result, textStatus, jqXHR) {
                if (result.status == "success") {
                    $('#chart2-browse-modal').show();
                    $('#chart2-browse-modal').html(result["data"]["correlations"].join(""));
                } else {
                    alert(result.message || "error");
                }
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                alert("Error: " + XMLHttpRequest);
            }
        });
    } catch (e) {

    }
}

/**
 * Show current expression's custom table, prepare to click button and show correlation chart
 * @param {*} result
 */
function showCustomExpressionTable(result) {
    var htmls = [], i, val1, val2, val3, val4;

    htmls.push('<div>');
    htmls.push('<table class="correlationTable">');
    htmls.push('<tr>');
    htmls.push('<th></th>');
    htmls.push('<th>Cgsite</th>');
    htmls.push('<th>Pearson cor</th>');
    htmls.push('<th>Pearson P-val</th>');
    htmls.push('<th>Spearman cor</th>');
    htmls.push('<th>Spearman P-val</th>');
    htmls.push('</tr>')
    for (i = 0; i < result["d"].length; i++) {
        val1 = "";
        val2 = "";
        val3 = "";
        val4 = "";
        if (typeof result["correlations"][i] != "undefined" && result["correlations"][i] != "") {
            val1 = result["correlations"][i][0];
            val2 = result["correlations"][i][1];
            val3 = result["correlations"][i][2];
            val4 = result["correlations"][i][3];
        }

        htmls.push('<tr>');
        htmls.push('<td><input type="checkbox" /></td>');
        htmls.push('<td>' + result["d"][i]["Cgcite"] + '</td>');
        htmls.push('<td>' + val1 + '</td>');
        htmls.push('<td>' + val2 + '</td>');
        htmls.push('<td>' + val3 + '</td>');
        htmls.push('<td>' + val4 + '</td>');
        htmls.push('</tr>')
    }
    htmls.push('</table>');

    htmls.push('<div><input type="button" class="correlation-btn" value="Start" /></div>');
    htmls.push('</div>');

    $('#table-browse-modal').html(htmls.join('')).show();

    // click correlation start
    $('#table-browse-modal .correlation-btn').on('click', function () {
        console.log("MY_DATA", MY_DATA);
        var data = {
            category: MY_DATA.modalCategory,
            type: MY_DATA.modalCancerType,
            feature: MY_DATA.methylationGene,
            entrez: MY_DATA.entrez,
        };

        var cgcites = [];
        $('#table-browse-modal .correlationTable input[type="checkbox"]').each(function (index) {
            if (!$(this).is(":checked")) {
                return;
            }
            cgcites.push(result["d"][index]["Cgcite"]);
        })

        if (cgcites.length == 0) {
            alert("Please select a row.");
            return;
        }

        data["cgcites"] = cgcites.join(",");
        drawCorrelationChart(data)
    })
}