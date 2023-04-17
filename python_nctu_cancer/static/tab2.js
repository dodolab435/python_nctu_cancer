
$(function () {
    // disable dataTable's warning
    $.fn.dataTable.ext.errMode = 'none';

    switch (MY_DATA.selectedCategory1) {
        case "mirna":
            typeName1 = "miRNA";
            break;
        case "mrna":
            typeName1 = "mRNA";
            break;
        case "lncrna":
            typeName1 = "lncRNA";
            break;
    }

    switch (MY_DATA.selectedCategory2) {
        case "mirna":
            typeName2 = "miRNA";
            break;
        case "mrna":
            typeName2 = "mRNA";
            break;
        case "lncrna":
            typeName2 = "lncRNA";
            break;
    }
    $('.browse-category').html('('+ typeName1 + ' & ' + typeName2 + ')');

    fillOption();

    // click sub tab
    $('.nav-sub-tab > li').on('click', function () {
        MY_DATA.selectedTab = $(this).find('a').data("value");

        $(this).siblings("li").removeClass("active");
        $(this).addClass("active");

        if (MY_DATA.selectedTab == "logrank") {
            $('.group-option').show();
        } else {
            $('.group-option').hide();
        }

        $('#chart-time').prop('selectedIndex', 0);

        showDataTable();
    })

    // change chart width or color
    $('.chart-option-color1, .chart-option-width1, .chart-option-color2, .chart-option-width2, .chart-option-marker-color1, .chart-option-marker-color2').on("change", function () {
        if (MY_DATA.chartJsonResult["chart_data"] && MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"]) {
            showChart();
        }
    })

    // search gene
    $('#search-btn').on("click", function () {
        MY_DATA.selectedCancerType = $('#select-browse-tab').val();
        $('#chart-time').prop('selectedIndex', 0);

        showDataTable();
    })

    // search for the gene names when keying input up
    $('#gene1, #gene2').on("keyup", function() {
        let name = $.trim($(this).val());
        if (name == "") {
            $(this).next('.search-result').html("");
            return;
        }

        let $obj = $(this).next('.search-result');
        let category = $(this).data("category");

        searchGeneNames(category, name, 100, $obj);
    }).on("click", function(e) {
        e.stopPropagation();
        $(this).next('.search-result').show();
    })

    // click gene name's search result
    $('.search-result').on("click", "div", function(e) {
        e.stopPropagation();
        $(this).parent().prev('input').val($(this).text());
        $(this).parent().hide();
    })

    $('body').on('click', function() {
        $('.search-result').hide();
    })

    // using select2 packages
    $('.group-select').select2();

    // whenever select group1 or group2, another same option will disabled
    $('.group-select').on('select2:select select2:unselect', function (e) {
        let vals, i, $target;

        if ($(this).attr("id") == "group1") {
            $target = $("#group2");
        } else {
            $target = $("#group1");
        }

        $target.find("option").attr("disabled", false);
        vals = $(this).val();
        for (i = 0; i < vals.length; i ++) {
            $target.find("option[value='" + vals[i] + "']").attr("disabled", true);
        }
    });
})

function fillOption() {

    $.ajax({
        url: rootUrl + '/api/category',
        type: "GET",
        dataType: "json",
        data: {
            category: MY_DATA.selectedCategory2
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
            url = rootUrl + '/api/two_gene';
            $('.group-option').show();
            break;
        case "aft":
        case "cox":
            url = rootUrl + '/api/cox_two_gene';
            $('.group-option').hide();
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
        ordering: false,
        processing: true,
        serverSide: true,
        bPaginate: true,
        sPaginationType: "full_numbers",
        columns: getColumns(MY_DATA.selectedCategory2, "", MY_DATA.selectedTab),
        rowCallback: function (row, data) {
            showRowWarning(row, data, MY_DATA.selectedCategory2, MY_DATA.selectedCancerType, MY_DATA.selectedTab);
        },
        dom: 'Bfrtip',
        buttons: [
            'copy', 'csv', 'excel', 'pdf', 'print'
        ],
    });

    // listen dataTable's event
    listenDataTableEvent($table, dataTable, MY_DATA.selectedCategory2, MY_DATA.selectedCancerType, MY_DATA.selectedTab);
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
                var mode = dataTable.row(this).data()[0];
                var type = dataTable.row(this).data()[3];
                var gene1 = dataTable.row(this).data()[4];
                var gene2 = dataTable.row(this).data()[5];
                var group1 = dataTable.row(this).data()[6];
                var group2 = dataTable.row(this).data()[7];
                let time = $('#chart-time').val();

                MY_DATA.selectedChartVals["mode"] = mode;
                MY_DATA.selectedChartVals["type"] = type;
                MY_DATA.selectedChartVals["gene1"] = gene1;
                MY_DATA.selectedChartVals["gene2"] = gene2;
                MY_DATA.selectedChartVals["group1"] = group1;
                MY_DATA.selectedChartVals["group2"] = group2;
                drawChart(mode, type, gene1, gene2, group1, group2, time);
            })
            break;
        case "aft":
        case "cox":
            $table.find("tbody").on("click", "tr", function () {
                var mode = dataTable.row(this).data()[0];
                var type = dataTable.row(this).data()[6];
                var gene1 = dataTable.row(this).data()[7];
                var gene2 = dataTable.row(this).data()[8];
                var tab = dataTable.row(this).data()[11];

                MY_DATA.drop_image_columns = [];
                drawCoxTwoGeneChart(mode, type, gene1, gene2, tab);
            })
            break;
        default:
            return;
    }
}

// get and show raw data
function retrieveData(url, aoData, fnCallback) {
    var limit = 10, skip = 0, keyword, colIndex, sortDir, subTab;
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

    if (MY_DATA.selectedCancerType == "" || $('#gene1').val() == "" || $('#gene2').val() == "") {
        console.log("empty result")
        return;
    }
    if (subTab == "logrank" && ($('#group1').val().length == 0 || $('#group2').val().length == 0)) {
        return;
    }
    console.log("selectedCancerType = " + MY_DATA.selectedCancerType + ", subTab = " + subTab)

    // hide chart
    $('.shiny-plot-output').hide();

    startLoading();

    $.ajax({
        url: url,
        type: "GET",
        dataType: "json",
        data: {
            category1: MY_DATA.selectedCategory1,
            category2: MY_DATA.selectedCategory2,
            type: MY_DATA.selectedCancerType,
            gene1: $('#gene1').val(),
            gene2: $('#gene2').val(),
            group1: $('#group1').val().join(','),
            group2: $('#group2').val().join(','),
            tab: MY_DATA.selectedTab,
        },
        complete: function (data, textStatus, jqXHR) {
            stopLoading();
        },
        success: function (result, textStatus, jqXHR) {
            if (result.status == 'success') {
                var data = getCallbackData(result.data, MY_DATA.selectedCategory2, MY_DATA.selectedCancerType, subTab);
                fnCallback(data, MY_DATA.selectedCategory2, MY_DATA.selectedCancerType, subTab); // 把返回的數據傳給這個方法就可以了,datatable會自動綁定數據的
            
                // show shape of HH, HL, LH, LL
                if (subTab == "logrank") {
                    $('.group-select option').each(function() {
                        // only show OS
                        switch($(this).val()) {
                            case "HH":
                                $(this).text("Gene1 High & Gene2 High(n=" + result.data["d"][0]["shape"]["HH"] + ")");
                                break;
                            case "HL":
                                $(this).text("Gene1 High & Gene2 Low(n=" + result.data["d"][0]["shape"]["HL"] + ")");
                                break;
                            case "LH":
                                $(this).text("Gene1 Low & Gene2 High(n=" + result.data["d"][0]["shape"]["LH"] + ")");
                                break;
                            case "LL":
                                $(this).text("Gene1 Low & Gene2 Low(n=" + result.data["d"][0]["shape"]["LL"] + ")");
                                break;
                        }
                    })
                    $("#group1, #group2").select2("destroy")
                        .select2();
                }
            } else {
                alert(result.message || 'error');
            }
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            alert("Status: " + textStatus + "\n"
                + "Error: " + errorThrown);
        }
    });
}

function chgChartTime() {
    let mode = MY_DATA.selectedChartVals["mode"];
    let type = MY_DATA.selectedChartVals["type"];
    let gene1 = MY_DATA.selectedChartVals["gene1"];
    let gene2 = MY_DATA.selectedChartVals["gene2"];
    let group1 = MY_DATA.selectedChartVals["group1"];
    let group2 = MY_DATA.selectedChartVals["group2"];
    let time = $('#chart-time').val();

    drawChart(mode, type, gene1, gene2, group1, group2, time)
}

function drawChart(mode, type, gene1, gene2, group1, group2, time) {

    try {
        startLoading();

        $.ajax({
            url: rootUrl + '/api/two_gene/img',
            type: "GET",
            dataType: "json",
            data: {
                category1: MY_DATA.selectedCategory1,
                category2: MY_DATA.selectedCategory2,
                mode: mode,
                type: type,
                gene1: gene1,
                gene2: gene2,
                group1: group1,
                group2: group2,
                time: time,
            },
            complete: function (data, textStatus, jqXHR) {
                stopLoading();
            },
            success: function (result, textStatus, jqXHR) {
                MY_DATA.chartJsonResult = JSON.parse(result)

                MY_DATA.two_gene_options = {
                    mode: mode,
                    type: type,
                    gene1: gene1,
                    gene2: gene2,
                    group1: group1,
                    group2: group2,
                    time: time,
                }

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

/**
 * Drawing more gene's cox or aft chart
 * @param {*} mode 
 * @param {*} type 
 * @param {*} gene1 
 * @param {*} gene2 
 * @param {*} tab 
 */
function drawCoxTwoGeneChart(mode, type, gene1, gene2, tab, ignore) {
    var $chart, $chart2;

    $chart = $('#chart-cox');
    $chart2 = $('#chart-cox-option');

    startLoading();

    try {
        $.ajax({
            url: rootUrl + '/api/cox_two_gene/img',
            type: "POST",
            dataType: "json",
            data: {
                category1: MY_DATA.selectedCategory1,
                category2: MY_DATA.selectedCategory2,
                mode: mode,
                type: type,
                gene1: gene1,
                gene2: gene2,
                tab: tab,
                drop_image_columns: MY_DATA.drop_image_columns
            },
            complete: function (data, textStatus, jqXHR) {
                stopLoading();
            },
            success: function (result, textStatus, jqXHR) {
                if (result.status == "success") {
                    MY_DATA.chartData = result;
                    console.log(result);
                    // showImgTable(mode, type, gene1, gene2, tab, $chart);
                    showImgTable($chart, tab);

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
    } catch (e) {

    }

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
    
            drawCoxTwoGeneChart(mode, type, gene1, gene2, tab, 1);
        })

        $chartObj.find('.csv_upload').on('click', function() { // do upload custom excel
            if ($chartObj.find('.cox_aft_file').val() == "") {
                alert("Please select a file.");
                return;
            }

            startLoading();

            var file_data = $chartObj.find('.cox_aft_file').prop('files')[0];   
            var form_data = new FormData();
            form_data.append('upload_file', file_data);
            form_data.append('category1', MY_DATA.selectedCategory1);
            form_data.append('category2', MY_DATA.selectedCategory2);
            form_data.append('mode', mode);
            form_data.append('type', type);
            form_data.append('gene1', gene1);
            form_data.append('gene2', gene2);
            form_data.append('tab', tab);
            $.ajax({
                url: rootUrl + '/api/cox_two_gene/upload', // <-- point to server-side PHP script 
                dataType: 'json',  // <-- what to expect back from the PHP script, if anything
                cache: false,
                contentType: false,
                processData: false,
                data: form_data,                         
                type: 'post',
                complete: function (data, textStatus, jqXHR) {
                    stopLoading();
                },
                success: function (result, textStatus, jqXHR) {
                    if (result.status == "success") {
                        MY_DATA.chartData = result;
                        var $chartUpload = $('#chart-upload');
                        showImgTable($chartUpload, tab);
                        addAftChartDownloadButton($chartUpload, mode, type, gene1, gene2, tab);
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
 * 取得欄位
 * @param {*} category 
 * @param {*} type 
 * @param {*} subTab 
 * @returns 
 */
function getColumns(category, type, subTab) {
    var data = [];

    switch (subTab) {
        case "logrank":
            data.push({ title: 'Survival Type' });
            data.push({ title: 'Number of Patients' });
            data.push({ title: 'P-val' });
            break;
        case "cox":
        case "aft":
            data.push({ title: 'Survival Type' });
            data.push({ title: 'Number of Patients' });
            data.push({ title: 'Coefficient (Gene1)' });
            data.push({ title: 'P-val (Gene1)' });
            data.push({ title: 'Coefficient (Gene2)' });
            data.push({ title: 'P-val (Gene2)' });
            break;
    }

    return data;
}

/**
 * search for the gene names
 * @param {*} category 
 * @param {*} name 
 * @param {*} limit 
 * @returns 
 */
function searchGeneNames(category, name, limit, $obj) {
    
    $.ajax({
        url: rootUrl + '/api/gene/name',
        type: "GET",
        dataType: "json",
        data: {
            category: category,
            name: name,
            limit: limit,
            clean_gene: "1"
        },
        complete: function (data, textStatus, jqXHR) {
        },
        success: function (result, textStatus, jqXHR) {
            if (result.status == "success") {
                showGeneSearchResult($obj, result.data);
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
function showGeneSearchResult($obj, data) {
    let i, htmls = [];
    for (i = 0; i < data.length; i ++) {
        htmls.push('<div>' + data[i] + '</div>');
    }

    if (htmls.length == 0) {
        $obj.html('').hide();
        return;
    }

    let $html = $(htmls.join(''));

    $obj.html($html).show();
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
                tmpKeys.push("survival_type");
                tmpKeys.push("patients");
                tmpKeys.push("p_val");
                break;
            case "cox":
            case "aft":
                tmpKeys.push("survival_type");
                tmpKeys.push("patients");
                tmpKeys.push("gene1_coef");
                tmpKeys.push("gene1_p_val");
                tmpKeys.push("gene2_coef");
                tmpKeys.push("gene2_p_val");
                break;
        }

        var d = [];
        for (var i = 0; i < tmpKeys.length; i++) {

            // 忽略大小寫
            var val = data[Object.keys(data).find(key => key.toLowerCase() === tmpKeys[i].toLowerCase())];
            if (typeof val == "undefined" || ["", "NA", "NAN"].includes(val)) {
                d.push("-");
            } else {
                d.push(val);
            }
        }

        // 放入其他準備繪圖需要數值
        d.push(type);
        d.push($('#gene1').val());
        d.push($('#gene2').val());
        d.push($('#group1').val().join(','));
        d.push($('#group2').val().join(','));
        d.push(subTab);
        return d;
    }

    for (var i in data.d) {
        details.push(_get(data.d[i], category, type, subTab, 0));
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
 * 顯示警告列標示
 * @param {*} row 
 * @param {*} data 
 * @param {*} category 
 * @param {*} type 
 * @param {*} subTab 
 */
function showRowWarning(row, data, category, type, subTab) {
    var suffix;

    console.log(subTab)
    if (["methylation27k", "methylation450k"].includes(category)) {
        suffix = $('[name="browse-modal-mode"]:checked').val();
    } else {
        suffix = $('[name="browse-mode"]:checked').val();
    }
    switch (subTab) {
        case "logrank":
            if (parseFloat(data[2]) < 0.05) {
                $(row).addClass('row-warning-red');
            }
            break;
        case "cox":
        case "aft":
            if (parseFloat(data[3]) < 0.05 || parseFloat(data[5]) < 0.05) {
                $(row).addClass('row-warning-red');
            }
            break;
    }
}

function downloadTwoGene(mode, type, gene1, gene2, group1, group2) {
    window.open(rootUrl + '/api/two_gene/download?category1=' + MY_DATA.selectedCategory1 + '&category2=' + MY_DATA.selectedCategory2 + '&mode=' + mode + '&type=' + type + '&gene1=' + gene1 + '&gene2=' + gene2 + '&group1=' + group1 + '&group2=' + group2);
}

function downloadCoxTwoGene(mode, type, gene1, gene2, tab) {
    window.open(rootUrl + '/api/cox_two_gene/download?category1=' + MY_DATA.selectedCategory1 + '&category2=' + MY_DATA.selectedCategory2 + '&mode=' + mode + '&type=' + type + '&gene1=' + gene1 + '&gene2=' + gene2 + '&tab=' + tab);
}

// function startLoading() {
//     if (MY_DATA.loadingFlag == 0) {
//         $("body").loading();
//         $('.loading-overlay-content').html('<img src="' + rootUrl + '/static/images/loading.gif" /> Loading...');
//     }

//     MY_DATA.loadingFlag++;
// }

// function stopLoading() {
//     MY_DATA.loadingFlag--;

//     if (MY_DATA.loadingFlag <= 0) {
//         MY_DATA.loadingFlag = 0;
//         $("body").loading("stop");
//     }
// }

$(".chart-option-cutoff").attr('disabled', true);

function addChartDownloadButton($chart){
    var $download = '<div style="text-align:center; padding-bottom: 40px;"><a href="#" onclick="downloadTwoGene(\'' + MY_DATA.two_gene_options["mode"] + '\', \'' + MY_DATA.two_gene_options["type"] + '\', \'' + MY_DATA.two_gene_options["gene1"] + '\', \'' + MY_DATA.two_gene_options["gene2"] + '\', \'' + MY_DATA.two_gene_options["group1"] + '\', \'' + MY_DATA.two_gene_options["group2"] + '\')">Download clinical data</a></div>';
    $chart.append($download);
}

function addAftChartDownloadButton($chart, mode, type, gene1, gene2, tab){
    var $download = '<div style="text-align:center; padding-bottom: 40px;"><a href="#" onclick="downloadCoxTwoGene(\'' + mode + '\', \'' + type + '\', \'' + gene1 + '\', \'' + gene2 + '\', \'' + tab + '\')">Download clinical data</a></div>';
    $chart.append($download);
}