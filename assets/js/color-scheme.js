'use strict'
$(document).ready(function () {
    var html = $('html');
    var body = $('body');

    $(document).on('click', '#darkmodeswitch', function () {
        if ($(this).is(':checked')) {
        $('#darkmodeswitch').prop('checked', true);
        html.addClass('dark-mode');
        } else {
            $('#btn-layout-modes-light').prop('checked', true);
        $('#btn-layout-modes-dark').prop('checked', false);
        html.removeClass('dark-mode');;
        }
    });

});
