
$(function () {
    // disable dataTable's warning
    $.fn.dataTable.ext.errMode = 'none';

    fillOption();

    // click sub tab
    $('.nav-sub-tab > li').on('click', function () {
        MY_DATA.selectedTab = $(this).find('a').data("value");

        $(this).siblings("li").removeClass("active");
        $(this).addClass("active");

        $('#chart-time').prop('selectedIndex', 0);

        showDataTable();
    })

    // display gene name
    $('#gene1, #gene2, #gene3').on("keyup", function() {
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

    // change cancer type to decide whether hide lncrna gene
    $('#select-browse-tab').on('change', function() {
        let limitTypes = ['BLCA', 'BRCA', 'CESC', 'COAD', 'GBM', 'HNSC', 'KICH', 'KIRC', 'KIRP', 'LGG', 'LIHC', 'LUAD' , 'LUSC', 'OV', 'PRAD', 'READ', 'SKCM', 'STAD','THCA', 'UCEC'];
        if (limitTypes.includes($(this).val())) {
            $('#gene3').parent().show();
        } else {
            $('#gene3').parent().hide();
            $('.select-result:eq(2) div').remove();
        }
    })

    $('#select-browse-tab').trigger("change");

    // click gene name's search result
    $('.search-result').on("click", "div", function(e) {
        e.stopPropagation();
        var $this = $(this);

        // skip if added
        var genes = [];
        $this.parent().next("div").find('div').each(function() {
            genes.push($(this).text());
        });

        if (!genes.includes($this.text())) {
            $(this).parent().next("div").append('<div>' + $(this).text() + '</div>');
        }
        
        $(this).parent().hide();
    })

    $('body').on('click', function() {
        $('.search-result').hide();
    })

    $('.select-result').on('click', 'div', function() {
        $(this).remove();
    })

    // search gene
    $('#search-btn').on("click", function() {
        MY_DATA.selectedCancerType = $('#select-browse-tab').val();
        $('#chart-time').prop('selectedIndex', 0);

        showDataTable();
    })
})

function fillOption() {

    for (let val in MY_DATA.cancer_abbr) {
        $('#select-browse-tab').append($('<option>', {
            value: val,
            text: MY_DATA.cancer_abbr[val] + " (" + val + ")"
        }));
    }
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
 * show DataTable
 * @returns 
 */
function showDataTable() {
    var url;
    switch (MY_DATA.selectedTab) {
        case "aft":
        case "cox":
            url = rootUrl + '/api/more_gene';
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
        case "aft":
        case "cox":
            $table.find("tbody").on("click", "tr", function () {
                var mode = dataTable.row(this).data()[0];
                MY_DATA.drop_image_columns = [];
                drawMoreGeneChart(mode);
            })
            break;
        default:
            return;
    }
}

// get and show raw data
function retrieveData(url, aoData, fnCallback) {
    var limit = 10, skip = 0, keyword, colIndex, sortDir, subTab, 
        gene_mrnas = [], gene_mirnas = [], gene_lncrnas = [];

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

    $('.select-result div').each(function() {
        let category = $(this).parent().data("category");
        if (category == "mrna") {
            gene_mrnas.push($(this).text());
        } else if (category == 'mirna') {
            gene_mirnas.push($(this).text());
        } else if (category == 'lncrna') {
            gene_lncrnas.push($(this).text());
        }
    })

    if (MY_DATA.selectedCancerType == "" || (gene_mrnas.length == 0 && gene_mirnas.length == 0 && gene_lncrnas.length == 0)) {
        return;
    }
    console.log("selectedCancerType = " + MY_DATA.selectedCancerType + ", subTab = " + subTab)

    // hide chart
    $('.shiny-plot-output').hide();

    startLoading();

    let dataParams = {
        type: MY_DATA.selectedCancerType,
        gene_mrnas: gene_mrnas,
        gene_mirnas: gene_mirnas,
        gene_lncrnas: gene_lncrnas,
        tab: MY_DATA.selectedTab,
    }

    MY_DATA.selectedData = dataParams;

    $.ajax({
        url: url,
        type: "POST",
        dataType: "json",
        data: dataParams,
        complete: function (data, textStatus, jqXHR) {
            stopLoading();
        },
        success: function (result, textStatus, jqXHR) {
            if (result.status == 'success') {
                MY_DATA.allData = result.data["d"];

                var data = getCallbackData(result.data, MY_DATA.selectedCategory2, MY_DATA.selectedCancerType, subTab);
                fnCallback(data, MY_DATA.selectedCategory2, MY_DATA.selectedCancerType, subTab); // 把返回的數據傳給這個方法就可以了,datatable會自動綁定數據的
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

    function _get(data, category, type, subTab, mode) {
        let genes = [];
        $('.select-result div').each(function() {
            genes.push($(this).text());
        })

        if ("patients" in data) {
            patients = data["patients"];
        } else {
            patients = "-";
        }

        var d = [mode, patients], gene_name;
        for (let i = 0; i < genes.length; i ++) {
            gene_name = genes[i];
            if (data[gene_name]) {
                d.push(data[gene_name]["coef"]);
                d.push(data[gene_name]["p"]);
            } else {
                console.log("not found " + gene_name)
                d.push("-");
                d.push("-");
            }
        }
        return d;
    }

    for (var mode in data.d) {
        details.push(_get(data.d[mode], category, type, subTab, mode));
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
 * get columns
 * @param {*} category 
 * @param {*} type 
 * @param {*} subTab 
 * @returns 
 */
function getColumns(category, type, subTab) {
    var data = [];

    let genes = [];
    $('.select-result div').each(function() {
        genes.push($(this).text());
    })

    switch (subTab) {
        case "cox":
        case "aft":
            data.push({ title: 'Survival Type' });
            data.push({ title: 'Number of Patients' });
            for (let i = 0; i < genes.length; i ++) {
                data.push({ title: 'Coefficient (' + genes[i] + ')' });
                data.push({ title: 'P-val (' + genes[i] + ')' });
            }
            break;
    }

    return data;
}

/**
 * Drawing more gene's cox or aft chart
 * @param {*} mode 
 */
function drawMoreGeneChart(mode, ignore) {
    let dataParams = MY_DATA.selectedData, $chart, $chart2;
    
    $chart = $('#chart');
    $chart2 = $('#chart2');
    dataParams["mode"] = mode;
    dataParams["drop_image_columns"] = MY_DATA.drop_image_columns;

    startLoading();

    try {
        $.ajax({
            url: rootUrl + '/api/more_gene/img',
            type: "POST",
            dataType: "json",
            data: dataParams,
            complete: function (data, textStatus, jqXHR) {
                stopLoading();
            },
            success: function (result, textStatus, jqXHR) {
                if (result.status == "success") {
                    MY_DATA.chartData = result;
                    showImgTable(mode, $chart, MY_DATA.selectedTab);

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
    
            drawMoreGeneChart(mode, 1);
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

            startLoading();

            var file_data = $chartObj.find('.cox_aft_file').prop('files')[0];   
            var form_data = new FormData();
            form_data.append('upload_file', file_data);
            for (var k in dataParams) {
                if (typeof dataParams[k] === 'object') {
                    for (var l in dataParams[k]) {
                        form_data.append(k + '[]', dataParams[k][l]);
                    }
                } else {
                    form_data.append(k, dataParams[k]);
                }
            }
            
            $.ajax({
                url: rootUrl + '/api/more_gene/upload', // <-- point to server-side PHP script 
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
                        showImgTable(mode, $chartUpload, MY_DATA.selectedTab, 1);
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
function showImgTable(mode, $chart, tab, hideDownload) {
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
        var $download = '<div style="text-align:center; padding-bottom: 40px;"><a href="#" onclick="downloadMoreGene(\'' + mode + '\')">Download clinical data</a></div>';
        $chart.append($download);
    }
}

/**
 * download more gene's data
 * @param {*} mode 
 */
function downloadMoreGene(mode) {
    let i;

    $('#downloadForm input').remove();
    
    $('#downloadForm').append('<input type="hidden" name="type" value="' + MY_DATA.selectedData["type"] + '" />');
    $('#downloadForm').append('<input type="hidden" name="tab" value="' + MY_DATA.selectedData["tab"] + '" />');
    $('#downloadForm').append('<input type="hidden" name="mode" value="' + mode + '" />');
    for (i = 0; i < MY_DATA.selectedData["gene_mrnas"].length; i ++) {
        $('#downloadForm').append('<input type="hidden" name="gene_mrnas[]" value="' + MY_DATA.selectedData["gene_mrnas"][i] + '" />');
    }
    for (i = 0; i < MY_DATA.selectedData["gene_mirnas"].length; i ++) {
        $('#downloadForm').append('<input type="hidden" name="gene_mirnas[]" value="' + MY_DATA.selectedData["gene_mirnas"][i] + '" />');
    }
    for (i = 0; i < MY_DATA.selectedData["gene_lncrnas"].length; i ++) {
        $('#downloadForm').append('<input type="hidden" name="gene_lncrnas[]" value="' + MY_DATA.selectedData["gene_lncrnas"][i] + '" />');
    }
    $('#downloadForm').submit();
}

function startLoading() {
    if (MY_DATA.loadingFlag == 0) {
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