
$(function () {

    // page info
    switch (MY_DATA.selectedCategory) {
        case "protein":
            typeName = "Protein";
            break;
        case "mirna":
            typeName = "miRNA";
            break;
        case "mrna":
            typeName = "mRNA";
            break;
        case "lncrna":
            typeName = "lncRNA";
            break;
    }
    $('.browse-category').html('('+ typeName +')');

    // disable dataTable's warning
    $.fn.dataTable.ext.errMode = 'none';

    fillOption();

    // click sub tab
    $('.nav-sub-tab > li').on('click', function () {
        MY_DATA.selectedTab = $(this).find('a').data("value");

        $(this).siblings("li").removeClass("active");
        $(this).addClass("active");
        if (MY_DATA.selectedGeneValue == "") {
            return;
        }

        showDataTable();
    })

    // search gene
    $('#btn-gene').on("click", function () {
        MY_DATA.selectedCancerType = $('#select-browse-tab').val();
        MY_DATA.selectedGeneValue = $.trim($('.search-gene').val());

        showDataTable();
    })

    // change chart width or color
    $('.chart-option-color1, .chart-option-width1, .chart-option-color2, .chart-option-width2, .chart-option-marker-color1, .chart-option-marker-color2').on("change", function () {
        if (MY_DATA.chartJsonResult["chart_data"] && MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"]) {
            showChart();
        }
    })

    // hide chart
    $('.shiny-plot-output').hide();

    // search for the gene names when keying input up
    $('.search-gene').on("keyup", function() {
        let name = $.trim($(this).val());
        if (name == "") {
            $('.search-result').html("");
            return;
        }

        searchGeneNames(name, 100);
    }).on("click", function(e) {
        e.stopPropagation();
        $('.search-result').show();
    })

    // click gene name's search result
    $('.search-result').on("click", "div", function(e) {
        e.stopPropagation();
        $('.search-gene').val($(this).text());
        $(this).parent().hide();
    })

    $('body').on('click', function() {
        $('.search-result').hide();
    })
})

function fillOption() {

    $.ajax({
        url: rootUrl + '/api/category',
        type: "GET",
        dataType: "json",
        data: {
            category: MY_DATA.selectedCategory
        },
        complete: function (data, textStatus, jqXHR) {
        },
        success: function (result, textStatus, jqXHR) {
            var jsonResult = JSON.parse(result);

            if (jsonResult.length > 0) {
                var i, text;

                for (i = 0; i < jsonResult[0].length; i++) {
                    var element = jsonResult[0][i];
                    text = element.name;
                    if (["FFPE Pilot Phase II", "FPPP"].includes(text)) {
                        continue;
                    }
                    if (typeof MY_DATA.cancer_abbr[text] != "undefined") {
                        text = MY_DATA.cancer_abbr[text] + " (" + text + ")";
                    }

                    $('#select-browse-tab').append($('<option>', {
                        value: element.name,
                        text: text
                    }));
                }

                MY_DATA.selectedCancerType = $('#select-browse-tab').val();
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            alert("Status: " + textStatus + "\n"
                + "Error: " + errorThrown);
        }
    });

}

/**
 * show DataTable
 * @returns 
 */
function showDataTable() {
    var url;
    switch (MY_DATA.selectedTab) {
        case "logrank":
            url = rootUrl + '/api/logrank';
            break;
        case "aft":
            url = rootUrl + '/api/aftdata';
            break;
        case "cox":
            url = rootUrl + '/api/coxdata';
            break;
        case "expression":
            url = rootUrl + '/api/logrank';
            break;
        default:
            return;
    }

    var $table = $('<table class="display" width="100%"></table>');

    $('.datatable-box').html("").append($table);

    var dataTable = $table.DataTable({
        sAjaxSource: url,
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            aoData.push({ "name": "sub_tab", "value": MY_DATA.selectedTab });
            retrieveData(sSource, aoData, fnCallback)
        },
        searching: false,
        processing: true,
        serverSide: true,
        bPaginate: true,
        ordering: false,
        sPaginationType: "full_numbers",
        columns: getColumns(MY_DATA.selectedCategory, MY_DATA.selectedCancerType, MY_DATA.selectedTab),
        order: getOrder(MY_DATA.selectedCategory, MY_DATA.selectedCancerType, MY_DATA.selectedTab), // default order
        rowCallback: function (row, data) {
            showRowWarning(row, data, MY_DATA.selectedCategory, MY_DATA.selectedCancerType, MY_DATA.selectedTab);
        },
        dom: 'Bfrtip',
        buttons: [
            'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    // listen dataTable's event
    listenDataTableEvent($table, dataTable, MY_DATA.selectedCategory, MY_DATA.selectedCancerType, MY_DATA.selectedTab);
}

/**
 * show modal's DataTable
 * @param {*} e 
 * @param {*} category 
 * @param {*} gene 
 * @returns 
 */
function showModal(e, category, gene, entrez) {
    e.stopPropagation();

    MY_DATA.modalCategory = category;
    MY_DATA.modalCancerType = MY_DATA.selectedCancerType;
    MY_DATA.modalTab = "logrank";
    MY_DATA.entrez = entrez;
    $('#tbl-browse-modal').modal("show");

    if (category == "methylation27k") {
        $('#tbl-browse-modal .modal-title').text('methylation 27k');
    } else {
        $('#tbl-browse-modal .modal-title').text('methylation 450k');
    }

    // reset tab
    $('#nav-browse-modal li').removeClass("active").eq(0).addClass("active");
    MY_DATA.modalTab = 'logrank';

    showModalDataTable();

    // tab click event
    $("#nav-browse-modal li").unbind("click").on('click', function () {
        MY_DATA.modalTab = $(this).find('a').data("value");

        $(this).siblings("li").removeClass("active");
        $(this).addClass("active");

        // show or hide survival type
        if (MY_DATA.modalTab == "expression") {
            $(this).parent().next(".tab-content").find('.survival_type').hide();
        } else {
            $(this).parent().next(".tab-content").find('.survival_type').show();
        }

        showModalDataTable();
    })
}

function showModalDataTable() {
    var url;

    switch (MY_DATA.modalTab) {
        case "logrank":
            url = rootUrl + '/api/logrank';
            break;
        case "aft":
            url = rootUrl + '/api/aftdata';
            break;
        case "cox":
            url = rootUrl + '/api/coxdata';
            break;
        case "expression":
            url = rootUrl + '/api/logrank';
            break;
        default:
            return;
    }

    var $table = $('<table class="display" width="100%"></table>');

    $('.datatable-modal-box').html("").append($table);

    var dataTable = $table.DataTable({
        sAjaxSource: url,
        fnServerData: function (sSource, aoData, fnCallback) {
            /* Add some extra data to the sender */
            if (MY_DATA.modalTab == "expression") {
                aoData.push({ "name": "search_correlation", "value": 1 });
            }
            aoData.push({ "name": "sub_tab", "value": MY_DATA.modalTab });
            retrieveModalData(sSource, aoData, fnCallback);
        },
        searching: false,
        processing: true,
        serverSide: true,
        bPaginate: true,
        ordering: false,
        sPaginationType: "full_numbers",
        columns: getColumns(MY_DATA.modalCategory, MY_DATA.modalCancerType, MY_DATA.modalTab),
        order: getOrder(MY_DATA.modalCategory, MY_DATA.modalCancerType, MY_DATA.modalTab), // default order
        rowCallback: function (row, data) {
            showRowWarning(row, data, MY_DATA.modalCategory, MY_DATA.modalCancerType, MY_DATA.modalTab);
        },
        dom: 'Bfrtip',
        buttons: [
            'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    // listen dataTable's event
    listenDataTableEvent($table, dataTable, MY_DATA.modalCategory, MY_DATA.modalCancerType, MY_DATA.modalTab);
}

/**
 * listen datatable's event
 * @param {*} $table 
 * @param {*} dataTable 
 * @param {*} category 
 * @param {*} type 
 * @param {*} tab 
 * @returns 
 */
function listenDataTableEvent($table, dataTable, category, type, tab) {
    switch (tab) {
        case "logrank":
            $table.find("tbody").on("click", "tr", function () {
                var survivalType = dataTable.row(this).data()[0];
                var tmpMapping = {
                    "OS": "os",
                    "PFI": "pfi",
                    "DFI": "dfi",
                    "DSS": "dss",
                    "Overall": "os",
                    "Progression-Free": "pfi",
                    "Disease-Free": "dfi",
                    "Disease-Specific": "dss",
                }
                var mode = "os";
                if (typeof tmpMapping[survivalType] != "undefined") {
                    mode = tmpMapping[survivalType];
                }

                MY_DATA.selectedSurvivalType = mode;
                if (["lncrna"].includes(category)) {
                    MY_DATA.selectedMetaFeature = dataTable.row(this).data()[4];
                } else {
                    MY_DATA.selectedMetaFeature = dataTable.row(this).data()[1];
                }
                let time = $('#chart-time').val();
                drawChart(mode, category, time);
            })
            break;
        case "aft":
        case "cox":
            $table.find("tbody").on("click", "tr", function () {
                var survivalType = dataTable.row(this).data()[0];
                var tmpMapping = {
                    "OS": "os",
                    "PFI": "pfi",
                    "DFI": "dfi",
                    "DSS": "dss",
                    "Overall": "os",
                    "Progression-Free": "pfi",
                    "Disease-Free": "dfi",
                    "Disease-Specific": "dss",
                }
                var mode = "os";
                if (typeof tmpMapping[survivalType] != "undefined") {
                    mode = tmpMapping[survivalType];
                }

                var index1 = 1, cgcite = "";
                if (["methylation27k", "methylation450k"].includes(category)) {
                    index1 = 2;
                    cgcite = dataTable.row(this).data()[6] || "";
                } else if (["mirna"].includes(category)) {
                    index1 = 1;
                } else if (["lncrna"].includes(category)) {
                    index1 = 6;
                }
                MY_DATA.selectedSurvivalType = mode;
                MY_DATA.selectedMetaFeature = dataTable.row(this).data()[index1];
                MY_DATA.drop_image_columns = [];

                drawNewAftChart(mode, category, tab, cgcite);
            })
            break;
        case "expression":
            $table.find("tbody").on("click", "tr", function () {
                MY_DATA.selectedMetaFeature = dataTable.row(this).data()[0];
                drawBoxPlot(MY_DATA.selectedMetaFeature, category);
            })
            break;
        default:
            return;
    }

    let $obj;
    if (["methylation27k", "methylation450k"].includes(category)) {
        $obj = $(".datatable-modal-box div.dataTables_filter input");
    } else {
        $obj = $(".datatable-box div.dataTables_filter input");
    }

    // when click enter to search instead keyup search 
    $obj.unbind().on("keyup", function (e) {
        if (e.keyCode == 13) {
            dataTable.search(this.value).draw();
        }
    });
}

// get and show raw data
function retrieveData(url, aoData, fnCallback) {
    var limit = 10, skip = 0, keyword, colIndex, sortColumn, sortDir, subTab;
    for (var i = 0; i < aoData.length; i++) {
        if (aoData[i]["name"] == "iDisplayStart") {
            skip = aoData[i]["value"];
        } else if (aoData[i]["name"] == "iDisplayLength") {
            limit = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sSearch") {
            keyword = aoData[i]["value"];
        } else if (aoData[i]["name"] == "iSortCol_0") {
            colIndex = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sSortDir_0") {
            sortDir = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sub_tab") {
            subTab = aoData[i]["value"];
        }
    }

    if (MY_DATA.selectedCategory == "" || MY_DATA.selectedCancerType == "" || MY_DATA.selectedGeneValue == "") {
        console.log("empty result")
        return;
    }
    console.log("selectedCategory = " + MY_DATA.selectedCategory + ", selectedCancerType = " + MY_DATA.selectedCancerType + ", subTab = " + subTab)

    sortColumn = getSortColumn(MY_DATA.selectedCategory, MY_DATA.selectedCancerType, subTab, colIndex);
    survival_type = getCheckColumn(MY_DATA.selectedCategory, subTab);

    // hide chart
    $('.shiny-plot-output').hide();

    startLoading();

    $.ajax({
        url: url,
        type: "GET",
        dataType: "json",
        data: {
            category: MY_DATA.selectedCategory,
            type: MY_DATA.selectedCancerType,
            gene: MY_DATA.selectedGeneValue,
            limit: limit,
            skip: skip,
            sort_col: sortColumn,
            sort_dir: sortDir,
            survival_type: survival_type,
        },
        complete: function (data, textStatus, jqXHR) {
            stopLoading();
        },
        success: function (result, textStatus, jqXHR) {
            var data = getCallbackData(result.data, MY_DATA.selectedCategory, MY_DATA.selectedCancerType, subTab);
            fnCallback(data, MY_DATA.selectedCategory, MY_DATA.selectedCancerType, subTab); // 把返回的數據傳給這個方法就可以了,datatable會自動綁定數據的
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            alert("Status: " + textStatus + "\n"
                + "Error: " + errorThrown);
        }
    });
}

/**
 * retrieve modal data
 * @param {*} url 
 * @param {*} aoData 
 * @param {*} fnCallback 
 * @returns 
 */
function retrieveModalData(url, aoData, fnCallback) {
    var limit = 10, skip = 0, keyword, searchCorrelation = 0, sortColumn, sortDir, subTab, colIndex;
    for (var i = 0; i < aoData.length; i++) {
        if (aoData[i]["name"] == "iDisplayStart") {
            skip = aoData[i]["value"];
        } else if (aoData[i]["name"] == "iDisplayLength") {
            limit = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sSearch") {
            keyword = aoData[i]["value"];
        } else if (aoData[i]["name"] == "search_correlation") {
            searchCorrelation = aoData[i]["value"];
        } else if (aoData[i]["name"] == "iSortCol_0") {
            colIndex = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sSortDir_0") {
            sortDir = aoData[i]["value"];
        } else if (aoData[i]["name"] == "sub_tab") {
            subTab = aoData[i]["value"];
        }
    }

    if (MY_DATA.modalCategory == "" || MY_DATA.modalCancerType == "") {
        return;
    }
    console.log("modalCategory = " + MY_DATA.modalCategory + ", modalCancerType = " + MY_DATA.modalCancerType + ", subTab = " + subTab)

    sortColumn = getSortColumn(MY_DATA.modalCategory, MY_DATA.modalCancerType, subTab, colIndex);
    survival_type = getCheckColumn(MY_DATA.selectedCategory, subTab);
    // hide chart
    $('.shiny-plot-output').hide();

    startModalLoading();

    $.ajax({
        url: url,
        type: "GET",
        dataType: "json",
        data: {
            category: MY_DATA.modalCategory,
            type: MY_DATA.modalCancerType,
            gene: MY_DATA.selectedGeneValue,
            entrez: MY_DATA.entrez,
            search_correlation: searchCorrelation,
            limit: limit,
            skip: skip,
            sort_col: sortColumn,
            sort_dir: sortDir,
            survival_type: survival_type,
        },
        complete: function (data, textStatus, jqXHR) {
            stopModalLoading();
        },
        success: function (result, textStatus, jqXHR) {
            if (searchCorrelation == 1) {
                showCustomExpressionTable(result.data);
            }
            var data = getCallbackData(result.data, MY_DATA.modalCategory, MY_DATA.modalCancerType, subTab);
            fnCallback(data); // 把返回的數據傳給這個方法就可以了,datatable會自動綁定數據的
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            alert("Status: " + textStatus + "\n"
                + "Error: " + errorThrown);
        }
    });
}

function chgChartTime(isModal) {
    var category, time;
    if (isModal) {
        category = MY_DATA.modalCategory;
        time = $('#chart-modal-time').val();
    } else {
        category = MY_DATA.selectedCategory;
        time = $('#chart-time').val();
    }

    drawChart(MY_DATA.selectedSurvivalType, category, time)
}

function drawChart(mode, category, time) {
    var L_per, H_per;
                
    if (["methylation27k", "methylation450k"].includes(category)) {
        L_per = $('#chart-modal-LP').val();
        H_per = $('#chart-modal-HP').val();
    } else {
        L_per = $('#chart-LP').val();
        H_per = $('#chart-HP').val();
    }

    try {
        if (["methylation27k", "methylation450k"].includes(category)) {
            startModalLoading();
        } else {
            startLoading();
        }

        $.ajax({
            url: rootUrl + '/api/chart',
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
                if (["methylation27k", "methylation450k"].includes(category)) {
                    stopModalLoading();
                } else {
                    stopLoading();
                }
            },
            success: function (result, textStatus, jqXHR) {
                if (result.status !== "success") {
                    alert(result.message || 'error')
                    return;
                }
                MY_DATA.chartJsonResult = result['data']
                MY_DATA.chartCategory = category;

                showChart();
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                alert("Error: " + errorThrown + '\n\n'
                    + "Message: " + XMLHttpRequest.responseJSON.replace(/\\n/g, '\n').replace(/\\"/g, '"'));
            }
        });
    } catch (e) {

    }
}

function showChart() {
    var $chart, $chartOption, divId;
    var chartIndex, L_per, H_per;

    if (["methylation27k", "methylation450k"].includes(MY_DATA.chartCategory)) {
        divId = 'chart-browse-modal';
        $chart = $('#chart-browse-modal');
        $chartOption = $('#chart-option-browse-modal');
        chartIndex = 1;
        L_per = $('#chart-modal-LP').val();
        H_per = $('#chart-modal-HP').val();
    } else {
        divId = 'chart';
        $chart = $('#chart');
        $chartOption = $('#chart-option');
        chartIndex = 0;
        L_per = $('#chart-LP').val();
        H_per = $('#chart-HP').val();
    }

    if (MY_DATA.chartJsonResult["chart_data"] && MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"]) {
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][0]["line"]["color"] = $('.chart-option-color1').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][0]["line"]["width"] = $('.chart-option-width1').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][1]["line"]["color"] = $('.chart-option-color2').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][1]["line"]["width"] = $('.chart-option-width2').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][2]["marker"]["color"] = $('.chart-option-marker-color1').eq(chartIndex).val();
        MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"][3]["marker"]["color"] = $('.chart-option-marker-color2').eq(chartIndex).val();
    }
    var chart1_data = MY_DATA.chartJsonResult["chart_data"][0].chart1_data;
    var chart_layout = MY_DATA.chartJsonResult["chart_data"][0].layout;

    $chartOption.show();
    $chart.html("").show();
    Plotly.newPlot(divId, chart1_data, chart_layout || {});

    var $download = '<div style="text-align:center; padding-bottom: 40px;"><a href="#" onclick="downloadChart(\'' + MY_DATA.chartCategory + '\', \'' + MY_DATA.selectedCancerType + '\', \'' + MY_DATA.selectedMetaFeature + '\', \'' + MY_DATA.selectedSurvivalType + '\', \'' + L_per + '\', \'' + H_per + '\')">Download clinical data</a></div>';
    $chart.append($download);
}

/**
 * Drawing more gene's cox or aft chart
 * @param {*} category 
 * @param {*} tab 
 * @param {*} cgcite 
 */
function drawNewAftChart(survivalType, category, tab, cgcite, ignore) {
    var $chart, $chart2;

    if (["methylation27k", "methylation450k"].includes(category)) {
        $chart = $('#chart-cox-modal');
        $chart2 = $('#chart2-browse-modal');
    } else {
        $chart = $('#chart-cox');
        $chart2 = $('#chart-cox-option');
    }

    if (["methylation27k", "methylation450k"].includes(category)) {
        startModalLoading();
    } else {
        startLoading();
    }

    $.ajax({
        url: rootUrl + '/api/aftplot',
        type: "POST",
        dataType: "json",
        data: {
            category: category,
            tab: tab,
            type: MY_DATA.selectedCancerType,
            feature: MY_DATA.selectedMetaFeature,
            cgcite: cgcite,
            survival_type: survivalType,
            drop_image_columns: MY_DATA.drop_image_columns
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
                MY_DATA.chartData = result;
                showImgTable(category, cgcite, survivalType, $chart, tab);

                if (ignore !== 1) {
                    _showSelectColumns($chart2);
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
        let htmls = [], tmpKeys = [], key, i;

        for (key in MY_DATA.chartData["data"]["summary"]) {
            tmpKeys.push(key);
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
        htmls.push('<input type="button" class="select_file" value="Select file" />&emsp;');
        htmls.push('<input type="button" class="csv_upload" value="Upload & reanalyze" />');
        htmls.push('</div>');

        $chartObj.show();
        $chartObj.html(htmls.join(''));

        // listening event and redraw table
        $chartObj.find('.btn').on('click', function() {
            MY_DATA.drop_image_columns = [];
            $chartObj.find('[name="img_checkbox"]').each(function() {
                if (!$(this).prop("checked")) {
                    MY_DATA.drop_image_columns.push($(this).val());
                }
            })
    
            drawNewAftChart(survivalType, category, tab, cgcite, 1);
        })
        
        // listening trigger file
        $chartObj.find('.select_file').on('click', function() {
            $chartObj.find('.cox_aft_file').trigger("click");
        });
        $chartObj.find('.cox_aft_file').on('change', function() {
            $chartObj.find('.temp_file_text').html($(this).val());
        });
        $chartObj.find('.csv_upload').on('click', function() { // do upload custom excel
            if ($chartObj.find('.cox_aft_file').val() == "") {
                alert("Please select a file.");
                return;
            }
    
            if (["methylation27k", "methylation450k"].includes(category)) {
                startModalLoading();
            } else {
                startLoading();
            }

            var file_data = $chartObj.find('.cox_aft_file').prop('files')[0];   
            var form_data = new FormData();
            form_data.append('upload_file', file_data);
            form_data.append('category', category);
            form_data.append('tab', tab);
            form_data.append('type', MY_DATA.selectedCancerType);
            form_data.append('feature', MY_DATA.selectedMetaFeature);
            form_data.append('cgcite', cgcite);
            form_data.append('survival_type', survivalType);
            $.ajax({
                url: rootUrl + '/api/aftplot/upload', // <-- point to server-side PHP script 
                dataType: 'json',  // <-- what to expect back from the PHP script, if anything
                cache: false,
                contentType: false,
                processData: false,
                data: form_data,                         
                type: 'post',
                complete: function (data, textStatus, jqXHR) {
                    if (["methylation27k", "methylation450k"].includes(category)) {
                        stopModalLoading();
                    } else {
                        stopLoading();
                    }
                },
                success: function (result, textStatus, jqXHR) {
                    if (result.status == "success") {
                        MY_DATA.chartData = result;

                        var $chartUpload;
                        if (["methylation27k", "methylation450k"].includes(category)) {
                            $chartUpload = $('#chart-modal-upload');
                        } else {
                            $chartUpload = $('#chart-upload');
                        }
                        showImgTable(category, cgcite, survivalType, $chartUpload, tab, 1);
                    } else {
                        alert(result.message || "error");
                    }
                },
                error: function (XMLHttpRequest, textStatus, errorThrown) {
                    alert("Error: " + XMLHttpRequest);
                }
            });
        });
    }
}

/**
 * Show cox or aft image's table
 */
function showImgTable(category, cgcite, survivalType, $chart, tab, hideDownload) {
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
            htmls.push('<tr align="center"><td>' + tmpKey + '</td><td>' + summaries[i]["exp(coef)"].toFixed(2) + '</td>');
            htmls.push('<td>[' + summaries[i]["exp(coef) lower 95%"].toFixed(2) + ', ' + summaries[i]["exp(coef) upper 95%"].toFixed(2) + ']</td>');
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
    htmls.push('</div>');
    htmls.push('</div>');

    $chart.show();
    $chart.html(htmls.join(''));

    if (hideDownload != 1) {
        var $download = '<div style="text-align:center; padding-bottom: 40px;"><a href="#" onclick="downloadAftPlot(\'' + category + '\', \'' + MY_DATA.selectedCancerType + '\', \'' + MY_DATA.selectedMetaFeature + '\', \'' + cgcite + '\', \'' + survivalType + '\')">Download clinical data</a></div>';
        $chart.append($download);
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
                    boxPlot(result["data"]["result"], category, gene);
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

function boxPlot(json, category, gene) {

    var x1 = [];
    var x2 = [];
    var trace1_y = [];
    var trace2_y = [];
    
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
    $chart.html("").show();
    Plotly.newPlot(divId, data, layout);
}

/**
 * get sort column by category and subtab etc.
 * @param {*} category 
 * @param {*} type 
 * @param {*} subTab 
 * @param {*} index 
 * @returns 
 */
function getSortColumn(category, type, subTab, index) {
    let mapping = [];
    var suffix = "os";

    switch (subTab) {
        case "logrank":
            mapping.push('MetaFeature');
            if (["methylation27k", "methylation450k"].includes(category)) {
                mapping.push('cgcite');
            }
            mapping.push('MetaFeature');
            if (category == "mirna") {
                mapping.push('MetaFeature');
            } else if (category == "mrna") {
                mapping.push('Entrez');
            }
            if (suffix == 'os') {
                mapping.push("os_exp");
                mapping.push("fdr_os_p");
            } else if (suffix == "pfi") {
                mapping.push("pfi_exp");
                mapping.push("fdr_pfi_p");
            } else if (suffix == "dfi") {
                mapping.push("dfi_exp");
                mapping.push("fdr_dfi_p");
            } else {
                mapping.push("dss_exp");
                mapping.push("fdr_dss_p");
            }
            break;
        case "cox":
        case "aft":
            mapping.push('MetaFeature');
            if (["methylation27k", "methylation450k"].includes(category)) {
                mapping.push('Cgcite');
            }
            mapping.push('MetaFeature');
            if (["mirna", "mrna"].includes(category)) {
                mapping.push('MetaFeature');
            }
            mapping.push('exp_coef_OS');
            mapping.push('exp_p_val_OS');
            mapping.push('fdr_exp_os');
            break;
        case "expression":
            if (["methylation27k", "methylation450k"].includes(category)) {
                mapping.push('cgcite');
            }
            mapping.push('MetaFeature');
            if (category == "mirna") {
                mapping.push('MetaFeature');
            } else if (category == "mrna") {
                mapping.push('MetaFeature');
            }
            mapping.push('normal_exp');
            mapping.push('tumor_exp');
            mapping.push('wilcoxon_p_val');
            break;
    }
    if (typeof mapping[index] != "undefined") {
        return mapping[index];
    } else {
        return mapping[0];
    }
}

function getCheckColumn(category, subTab) {

    switch (subTab) {
        case "logrank":
            checkColumn="os_exp";
            break;
        case "cox":
        case "aft":
            checkColumn = "MetaFeature"
            break;
        case "expression":
            break;
    }

    return checkColumn
}

/**
 * get columns
 * @param {*} category 
 * @param {*} selectedType 
 * @param {*} subTab 
 * @returns 
 */
function getColumns(category, selectedType, subTab) {
    var data = [];

    switch (subTab) {
        case "logrank":
            data.push({ title: 'Survival type' });

            var index = 1;
            var sep = "|";
            if (["methylation27k", "methylation450k"].includes(category)) {
                data.push({ title: 'CpG site' });
                index = 2;
            } else if (category == "mirna") {
                sep = ",";
            }
            data.push({
                title: 'Gene', render: function (data, type, row, meta) {
                    var tmp = row[index].split(sep);
                    return tmp[0];
                }
            });
            if (category == "mirna") {
                data.push({
                    title: "miRBASE ID", render: function (data, type, row, meta) {
                        var tmp = row[index].split(sep);
                        return tmp[1];
                    }
                });
            } else if (category == "mrna") {
                data.push({
                    title: "Entrez ID", render: function (data, type, row, meta) {
                        var tmp = row[index].split(sep);
                        return tmp[1];
                    }
                });
            }
            data.push({ title: 'P-val' });
            data.push({ title: 'Adjusted P-val' });

            if (category == "mrna") {
                if (MY_DATA.methylation27kTypes.includes(selectedType)) {
                    data.push({
                        title: "",
                        render: function (data, type, row, meta) {
                            var tmpFeatures = row[1].split("|");
                            return '<input type="button" value="27k" class="methylation-btn" onclick="showModal(event, \'methylation27k\', \'' + tmpFeatures[0] + '\', \'' + tmpFeatures[1] + '\')" />';
                        }
                    });
                }
                data.push({
                    title: "",
                    render: function (data, type, row, meta) {
                        var tmpFeatures = row[1].split("|");
                        return '<input type="button" value="450k" class="methylation-btn" onclick="showModal(event, \'methylation450k\', \'' + tmpFeatures[0] + '\', \'' + tmpFeatures[1] + '\')" />';
                    }
                });
            }
            break;
        case "cox":
        case "aft":
            if (category == "mrna") {
                data = [
                    {
                        title: "Survival type"
                    },
                    {
                        title: "Gene", render: function (data, type, row, meta) {
                            var tmp = row[1].split("|");
                            return tmp[0];
                        }
                    },
                    {
                        title: "EntrezID", render: function (data, type, row, meta) {
                            var tmp = row[1].split("|");
                            return tmp.length > 1 ? tmp[1] : "";
                        }
                    },
                    {
                        title: "Coefficient", render: function (data, type, row, meta) {
                            return row[2];
                        }
                    },
                    {
                        title: "P-val", render: function (data, type, row, meta) {
                            return row[3];
                        }
                    },
                    {
                        title: "Adjusted P-val", render: function (data, type, row, meta) {
                            return row[4];
                        }
                    },
                ];
                if (MY_DATA.methylation27kTypes.includes(selectedType)) {
                    data.push({
                        title: "",
                        render: function (data, type, row, meta) {
                            var tmpFeatures = row[1].split("|");
                            return '<input type="button" value="27k" class="methylation-btn" onclick="showModal(event, \'methylation27k\', \'' + tmpFeatures[0] + '\', \'' + tmpFeatures[1] + '\')" />';
                        }
                    })
                }
                data.push({
                    title: "",
                    render: function (data, type, row, meta) {
                        var tmpFeatures = row[1].split("|");
                        return '<input type="button" value="450k" class="methylation-btn" onclick="showModal(event, \'methylation450k\', \'' + tmpFeatures[0] + '\', \'' + tmpFeatures[1] + '\')" />';
                    }
                })
            } else {
                data.push({ title: 'Survival type' });
                if (["methylation27k", "methylation450k"].includes(category)) {
                    data.push({ title: 'CpG site' });
                }
                data.push({ title: 'Gene', render: function (data, type, row, meta) {
                        if (["mirna"].includes(category)) {
                            return data.split(",")[0];
                        } else {
                            return data;
                        }
                    }
                });
                if (["mirna"].includes(category)) {
                    data.push({ 
                        title: 'miRBASE', render: function (data, type, row, meta) {
                            return data.split(",")[1];
                        }
                    });
                }
                data.push({ title: 'Coefficient' });
                data.push({ title: 'P-val' });
                data.push({ title: 'Adjusted P-val' });
            }
            break;
        case "expression":
            if (["methylation27k", "methylation450k"].includes(category)) {
                data.push({ title: 'Cgcite' });
            }

            var sep = "|";
            if (category == "mirna") {
                sep = ",";
            }
            data.push({ title: 'Gene',
                render: function (data, type, row, meta) {
                    return data.split(sep)[0];
                }
            });
            if (category == "mirna") {
                data.push({ title: 'miRBASE ID',
                    render: function (data, type, row, meta) {
                        return row[0].split(sep)[1];
                    }
                });
            } else if (category == "mrna") {
                data.push({ title: 'Entrez ID' });
            }
            data.push({
                title: 'Expression (Normal)'
            });
            data.push({
                title: 'Expression (Tumor)'
            });
            data.push({
                title: 'Wilcoxon P-val'
            });

            if (category == "mrna") {
                if (MY_DATA.methylation27kTypes.includes(selectedType)) {
                    data.push({
                        title: "",
                        render: function (data, type, row, meta) {
                            return '<input type="button" value="27k" class="methylation-btn" onclick="showModal(event, \'methylation27k\', \'' + row[0] + '\', \'' + row[1] + '\')" />';
                        }
                    });
                }
                data.push({
                    title: "",
                    render: function (data, type, row, meta) {
                        return '<input type="button" value="450k" class="methylation-btn" onclick="showModal(event, \'methylation450k\', \'' + row[0] + '\', \'' + row[1] + '\')" />';
                    }
                });
            }
            break;
    }

    return data;
}

/**
 * 取得order結果
 * @param {*} category 
 * @param {*} type 
 * @param {*} subTab 
 */
function getOrder(category, type, subTab) {
    return [[0, 'asc']];
}

/**
 * 顯示警告列標示
 * @param {*} row 
 * @param {*} data 
 * @param {*} category 
 * @param {*} type 
 * @param {*} subTab 
 */
function showRowWarning(row, data, category, type, subTab) {
    switch (subTab) {
        case "logrank":
            let index = 3;
            if (["methylation27k", "methylation450k", "mirna", "mrna"].includes(category)) {
                index = 4;
            }
            if (parseFloat(data[index]) < 0.05) {
                $(row).addClass('row-warning-red');
            }
            break;
        case "cox":
            var index1 = 4, index2 = 2;
            if (["methylation27k", "methylation450k", "mirna"].includes(category)) {
                index1 = 5;
                index2 = 3;
            }

            if (parseFloat(data[index1]) < 0.05) {
                if (parseFloat(data[index2]) > 0) {
                    $(row).addClass('row-warning-red');
                } else {
                    $(row).addClass('row-warning-green');
                }
            }
            break;
        case "aft":
            var index1 = 4, index2 = 2;
            if (["methylation27k", "methylation450k", "mirna"].includes(category)) {
                index1 = 5;
                index2 = 3;
            }

            if (parseFloat(data[index1]) < 0.05) {
                if (parseFloat(data[index2]) > 0) {
                    $(row).addClass('row-warning-green');
                } else {
                    $(row).addClass('row-warning-red');
                }
            }
            break;
    }
}

/**
 * 取得callback組成資料a
 * @param {*} data 
 * @param {*} category 
 * @param {*} type 
 * @param {*} subTab 
 * @returns 
 */
function getCallbackData(data, category, type, subTab) {
    var details = [];

    function _get(data, category, type, subTab, keyIndex) {
        var tmpKeys = [];

        switch (subTab) {
            case "logrank":
                tmpKeys.push("");

                if (["methylation27k", "methylation450k"].includes(category)) {
                    tmpKeys.push("cgcite");
                }
                if (category == "lncrna") {
                    tmpKeys.push("gene_symbol");
                } else {
                    tmpKeys.push("MetaFeature");
                }
                if (["mirna", "mrna"].includes(category)) {
                    tmpKeys.push("MetaFeature");
                }

                if (keyIndex == 0) {
                    tmpKeys.push("os_exp");
                    tmpKeys.push("fdr_os_p");
                } else if (keyIndex == 1) {
                    tmpKeys.push("pfi_exp");
                    tmpKeys.push("fdr_pfi_p");
                } else if (keyIndex == 2) {
                    tmpKeys.push("dfi_exp");
                    tmpKeys.push("fdr_dfi_p");
                } else {
                    tmpKeys.push("dss_exp");
                    tmpKeys.push("fdr_dss_p");
                }
                tmpKeys.push("MetaFeature");
                break;
            case "cox":
            case "aft":
                tmpKeys.push("");

                if (["methylation27k", "methylation450k"].includes(category)) {
                    tmpKeys.push("Cgcite");
                }
                if (category == "lncrna") {
                    tmpKeys.push("gene_symbol");
                } else {
                    tmpKeys.push("MetaFeature");
                }
                if (category == "mirna") {
                    tmpKeys.push("MetaFeature");
                }

                if (keyIndex == 0) {
                    tmpKeys.push("exp_coef_OS");
                    tmpKeys.push("exp_p_val_OS");
                    tmpKeys.push("fdr_exp_os");
                } else if (keyIndex == 1) {
                    tmpKeys.push("exp_coef_PFI");
                    tmpKeys.push("exp_p_val_PFI");
                    tmpKeys.push("fdr_exp_pfi");
                } else if (keyIndex == 2) {
                    tmpKeys.push("exp_coef_DFI");
                    tmpKeys.push("exp_p_val_DFI");
                    tmpKeys.push("fdr_exp_dfi");
                } else {
                    tmpKeys.push("exp_coef_DSS");
                    tmpKeys.push("exp_p_val_DSS");
                    tmpKeys.push("fdr_exp_dss");
                }

                tmpKeys.push("cgcite");
                tmpKeys.push("MetaFeature");
                break;
            case "expression":
                if (["methylation27k", "methylation450k"].includes(category)) {
                    tmpKeys.push("cgcite");
                }
                if (category == "lncrna") {
                    tmpKeys.push("gene_symbol");
                } else {
                    tmpKeys.push("MetaFeature");
                }
                if (category == "mirna") {
                    tmpKeys.push("gene");
                } else if (category == "mrna") {
                    tmpKeys.push("Entrez");
                }
                tmpKeys.push("normal_exp");
                tmpKeys.push("tumor_exp");
                tmpKeys.push("wilcoxon_p_val");
                tmpKeys.push("MetaFeature");
                break;
        }

        var d = [];
        for (var i = 0; i < tmpKeys.length; i++) {
            // survival type
            if (i == 0 && ["logrank", "cox", "aft"].includes(subTab) ) {
                if (keyIndex == 0) {
                    d.push("Overall");
                } else if (keyIndex == 1) {
                    d.push("Progression-Free");
                } else if (keyIndex == 2) {
                    d.push("Disease-Free");
                } else {
                    d.push("Disease-Specific");
                }
                continue;
            }

            // 忽略大小寫
            var val = data[Object.keys(data).find(key => key.toLowerCase() === tmpKeys[i].toLowerCase())];
            if (typeof val == "undefined" || ["", "NA", "NAN"].includes(val)) {
                if (tmpKeys[i].toLowerCase() === "cgcite") {
                    d.push("");
                } else {
                    d.push("-");
                }
            } else {
                d.push(val);
            }
        }
        return d;
    }

    for (var i in data.d) {
        details.push(_get(data.d[i], category, type, subTab, 0));
        if (["logrank", "cox", "aft"].includes(subTab)) {
            details.push(_get(data.d[i], category, type, subTab, 1));
            details.push(_get(data.d[i], category, type, subTab, 2));
            details.push(_get(data.d[i], category, type, subTab, 3));
        }
    }

    var result = {
        "sEcho": "test",
        "iTotalRecords": data["total"],
        "iTotalDisplayRecords": data["total"],
        "aaData": details,
    };

    return result;
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

    $('#table-browse-modal').html(htmls.join(''))
        .show();

    // click correlation start
    $('#table-browse-modal .correlation-btn').on('click', function () {
        var data = {
            category: MY_DATA.modalCategory,
            type: MY_DATA.modalCancerType,
            feature: MY_DATA.selectedGeneValue,
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

/**
 * search for the gene names
 * @param {*} name 
 * @param {*} limit 
 * @returns 
 */
function searchGeneNames(name, limit) {
    
    $.ajax({
        url: rootUrl + '/api/logrank/name',
        type: "GET",
        dataType: "json",
        data: {
            name: name,
            limit: limit,
            category: MY_DATA.selectedCategory
        },
        complete: function (data, textStatus, jqXHR) {
        },
        success: function (result, textStatus, jqXHR) {
            if (result.status == "success") {
                showGeneSearchResult(result.data);
            } else {
                console.log(result.message || "error");
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            console.log("Error: " + XMLHttpRequest);
        }
    });
}

/**
 * Show search dropdown list result
 * @param {*} $obj 
 * @param {*} data 
 * @returns 
 */
function showGeneSearchResult(data) {
    let i, htmls = [];
    for (i = 0; i < data.length; i ++) {
        htmls.push('<div>' + data[i] + '</div>');
    }

    if (htmls.length == 0) {
        $('.search-result').html('').hide();
        return;
    }

    let $html = $(htmls.join(''));

    $('.search-result').html($html).show();
}

function drawCorrelationChart(data) {
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

function startLoading() {
    if (MY_DATA.loadingFlag == 0){
        $("body").loading();
        $('.loading-overlay-content').html('<img src="' + rootUrl + '/static/images/loading.gif" /> Loading...');
    }

    MY_DATA.loadingFlag++;
}

function stopLoading() {
    MY_DATA.loadingFlag--;

    if (MY_DATA.loadingFlag <= 0) {
        MY_DATA.loadingFlag = 0;
        $("body").loading("stop");
    }
}

function startModalLoading() {
    if (MY_DATA.loadingModalFlag == 0) {
        $(".modal").loading();
        $('.loading-overlay-content').html('<img src="' + rootUrl + '/static/images/loading.gif" /> Loading...');
    }

    MY_DATA.loadingModalFlag++;
}

function stopModalLoading() {
    MY_DATA.loadingModalFlag--;

    if (MY_DATA.loadingModalFlag <= 0) {
        MY_DATA.loadingModalFlag = 0;
        $(".modal").loading("stop");
    }
}

function downloadChart(category, type, feature, mode, L_per, H_per) {
    window.open(rootUrl + '/api/chart/download?category=' + category + '&type=' + type + '&feature=' + feature + '&mode=' + mode + '&L_per=' + L_per + '&H_per=' + H_per);
}

function downloadAftPlot(category, type, feature, cgcite, survivalType) {
    window.open(rootUrl + '/api/aftplot/download?category=' + category + '&type=' + type + '&feature=' + feature + '&cgcite=' + cgcite + '&survival_type=' + survivalType);
}