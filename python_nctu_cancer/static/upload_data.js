var MY_DATA = {
    chartJsonResult: ""
}

$("label[name='group_1']").html("1");
$("label[name='group_2']").html("2");

// 至少選擇一個col才顯示submit button
$(document).on('click', 'input[name="gene_expression_col"]', function() {
    console.log(get_checkedlist());
    if (get_checkedlist().length) {
        $('#submit_button').show();
    }else{
        $('#submit_button').hide();
    }
});

$(function () {
    $('#submit_button').hide();
    
    // change chart width or color
    $('.chart-option-color1, .chart-option-width1, .chart-option-color2, .chart-option-width2, .chart-option-marker-color1, .chart-option-marker-color2').on("change", function () {
        if (MY_DATA.chartJsonResult["chart_data"] && MY_DATA.chartJsonResult["chart_data"][0]["chart1_data"]) {
            showChart();
        }
    });
})

function chgChartTime(isModal) {
    startLoading();
    // $("#cox_aft_div").hide();
    // $("#logrank_div").hide();
    $('.shiny-plot-output').hide();

    console.log($("#select_a").val(), $('#day_col').val(), $('#status_col').val(), get_checkedlist());
    checkedList = get_checkedlist();

    var formData = new FormData();
    formData.append('file', $('#input-file')[0].files[0]);
    formData.append('day_col', $('#day_col').val());
    formData.append('status_col', $('#status_col').val());
    formData.append('gene_expression_col', checkedList[0]);
    $("input[name='gene_expression_col']:checked").each(function(index, checkbox) {
        formData.append("expression_col_list", $(checkbox).val());
        formData.append("expression_col_class_list", $(checkbox).siblings("select[name='col_class']").val());
        formData.append("expression_col_base_list", $(checkbox).siblings(".category_div").children("select[name='base_val']").val());
    });
    switch ($("#select_a").val()){
        case "logrank":
            if (checkedList.length != 1){
                alert("選一個exp col");
                break;
            }
            formData.append('L_per', $('#chart-LP').val());
            formData.append('H_per', $('#chart-HP').val());
            formData.append('time', $('#chart-time').val());

            $.ajax({
                url: rootUrl + '/api/upload_data_chart',
                type: "POST",
                data: formData,
                processData: false,
                contentType: false,
                complete: function (data, textStatus, jqXHR) {
                    stopLoading();
                },
                success: function (result, textStatus, jqXHR) {
                    if (result.status !== "success") {
                        alert(result.message || 'error')
                        return;
                    }
                    MY_DATA.chartJsonResult = result['data'];
                    $('#chart-LP').val(result['data']['L_per']);
                    $('#chart-HP').val(result['data']['H_per']);
                    showChart();
                },
                error: function (XMLHttpRequest, textStatus, errorThrown) {
                    alert("Error: " + errorThrown + '\n\n'
                        + "Message: " + XMLHttpRequest.responseJSON.replace(/\\n/g, '\n').replace(/\\"/g, '"'));
                }
            });
            break;
        case "cox":
            $.ajax({
                url: rootUrl + '/api/upload_data_cox',
                type: "POST",
                data: formData,
                processData: false,
                contentType: false,
                complete: function (data, textStatus, jqXHR) {
                    stopLoading();
                },
                success: function (result, textStatus, jqXHR) {
                    if (result.status !== "success") {
                        alert(result.message || 'error')
                        return;
                    }
                    
                    $chart = $('#chart-cox');
                    MY_DATA.chartData = result
                    showImgTable($chart, "cox");
                    $chart2 = $('#chart-cox-option');
                    $chart2.show();
                    $chart2.html('<input type="button" value="Download PDF" onclick="downloadPdf(false)" />');
                },
                error: function (XMLHttpRequest, textStatus, errorThrown) {
                    alert("Error: " + errorThrown + '\n\n'
                        + "Message: " + XMLHttpRequest.responseJSON.replace(/\\n/g, '\n').replace(/\\"/g, '"'));
                }
            });
            break;
        case "aft":
            $.ajax({
                url: rootUrl + '/api/upload_data_aft',
                type: "POST",
                data: formData,
                processData: false,
                contentType: false,
                complete: function (data, textStatus, jqXHR) {
                    stopLoading();
                },
                success: function (result, textStatus, jqXHR) {
                    if (result.status !== "success") {
                        alert(result.message || 'error')
                        return;
                    }
                    $chart = $('#chart-cox');
                    MY_DATA.chartData = result
                    showImgTable($chart, "aft");
                    $chart2 = $('#chart-cox-option');
                    $chart2.show();
                    $chart2.html('<input type="button" value="Download PDF" onclick="downloadPdf(false)" />');
                },
                error: function (XMLHttpRequest, textStatus, errorThrown) {
                    alert("Error: " + errorThrown + '\n\n'
                        + "Message: " + XMLHttpRequest.responseJSON.replace(/\\n/g, '\n').replace(/\\"/g, '"'));
                }
            });
            break;
    }
}

$(document).ready(function() {
    $('#day_col, #status_col').on("change", function () {
        console.log($(this).val());
    });
    

    $("#select_a").on("change", function () {
        $("#gene_expression_logrank_div").hide();
        $("#gene_expression_coxaft_div").hide();
        $('input[name="gene_expression_col"]').prop('checked', false);
        $('#submit_button').hide();
        $(".shiny-plot-output").hide();
        switch ($(this).val()){
            case "logrank":
                $("#gene_expression_logrank_div").show();
                break;
            case "cox":
            case "aft":
                $("#gene_expression_coxaft_div").show();
                break;
        };
    });

    $("#load_col").click(function(){
        startLoading();

        var formData = new FormData();
        formData.append('file', $('#input-file')[0].files[0]);
        $.ajax({
        url: rootUrl + '/api/upload_data_get_col',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        complete: function (data, textStatus, jqXHR) {
            stopLoading();
        },
        success: function(data) {
            file_col_name = data['data']['col']
            $("#col_select_div").show();
            $('#day_col').html("");
            $('#status_col').html("");
            $('#gene_expression_logrank_div').html("");
            $('#gene_expression_coxaft_div').html("");
            for (let i = 0; i < file_col_name.length; i++) {
                $('#day_col').append($('<option>').val(file_col_name[i]).text(file_col_name[i]));
                $('#status_col').append($('<option>').val(file_col_name[i]).text(file_col_name[i]));
                $('#gene_expression_logrank_div').append("<label><input type='radio' name='gene_expression_col' value='" + file_col_name[i] + "'/>&nbsp;" + file_col_name[i] + "</label><br>");
                s = "<label class='fontNoBold'><input type='checkbox' name='gene_expression_col' value='" + file_col_name[i] + "'/>&nbsp;";
                s += "<label>";
                s += file_col_name[i];
                s += "</label>";
                s += " is ";
                s += "<select name='col_class'></select>";
                s += "<label class='category_div fontNoBold' hidden>";
                s += "&nbsp;and ";
                s += "<select name='base_val'>"
                for (let k = 0; k < data['data'][file_col_name[i]].length; k++) {
                    s += "<option value='" + data['data'][file_col_name[i]][k] + "'>" + data['data'][file_col_name[i]][k] + "</option>"
                }
                s += "</select>"
                s += " is the reference";
                s += "</label>"
                s += "</label><br>"
                $('#gene_expression_coxaft_div').append(s);
            }
            $("select[name='col_class']").each(function() {
                $(this).html("<option value='continuous'>Continuous</option>\
                              <option value='category'>Category</option>");
            });
            $("#select_a").change();
            $("select[name='col_class']").on("change", function () {
                if ($(this).val() == "category"){
                    $(this).siblings(".category_div").show();
                }else{
                    $(this).siblings(".category_div").hide();
                }
            });
        },
        error: function(xhr, status, error) {
            console.log(error);
        }
        });
    });
});

function get_checkedlist(){
    var checkedList = $('input[name="gene_expression_col"]:checked').map(function(){
        return $(this).val();
    }).get();
    // var classList = $('input[name="gene_expression_col"]:checked').map(function(){
    //     return $(this).siblings("select[name='col_class']").val();
    // }).get();
    return checkedList
}
