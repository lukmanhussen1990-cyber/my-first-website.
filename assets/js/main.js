'use strict'
$(document).ready(function () {

    var body = $('body');
    var bodyParent = $('html');
	
			
  var _originalSize = $(window).width() + $(window).height();
  var oriheight = $(window).width() + $(window).height();
  $(window).resize(function(){
    if($(window).width() + $(window).height() != _originalSize){
	//alert(oriheight-$(window).height());
      //body.addClass('input-clicked');
     // $(".copyright_link").css("position","relative");  
    }else{
     if (body.hasClass('input-clicked') === true) {
	//body.removeClass('input-clicked');
	}
    }
  });
	
	
	$('body').click(function (e) {
	if(e.target.className === "bi my-float bi-plus")
    {
	$('.my-float').addClass('bi-x').removeClass('bi-plus');
	$(".fab-options").css("opacity",1);
	$(".fab-options").css("transform","scale(1)");
	}
	else if(e.target.className === "bi my-float bi-x")
    {
	$('.my-float').addClass('bi-plus').removeClass('bi-x');
	$(".fab-options").css("opacity",0);
	$(".fab-options").css("transition","all 0.3s ease");
	$(".fab-options").css("transform","scale(0)");
	$(".fab-icon-holder").css("opacity",1);
	}
	else
	{
	$('.my-float').addClass('bi-plus').removeClass('bi-x');
	$(".fab-options").css("opacity",0);
	$(".fab-options").css("transition","all 0.3s ease");
	$(".fab-options").css("transform","scale(0)");
	$(".fab-icon-holder").css("opacity",1);
	}
    });
	
	
    $(document).on('click', '#darkmodeswitch', function () {
        if ($(this).is(':checked')) {
        $('#darkmodeswitch').prop('checked', true);
        bodyParent.addClass('dark-mode');
        } else {
            $('#btn-layout-modes-light').prop('checked', true);
        $('#btn-layout-modes-dark').prop('checked', false);
        bodyParent.removeClass('dark-mode');;
        }
    });

    /* page load as iframe */
    if (self !== top) {
        body.addClass('iframe');
    } else {
        body.removeClass('iframe');
    }

    /* menu open close */
    $(document).on('click', '.menu-btn', function () {
        if (body.hasClass('menu-open') === true) {
            body.removeClass('menu-open');
            bodyParent.removeClass('menu-open');
        } else {
            body.addClass('menu-open');
            bodyParent.addClass('menu-open');
        }

        return false;
    });

    body.on("click", function (e) {
        if (!$('.sidebar').is(e.target) && $('.sidebar').has(e.target).length === 0) {
            body.removeClass('menu-open');
            bodyParent.removeClass('menu-open');
        }

        return true;
    });



    /* menu style switch */
    $(document).on('change', '#menu-pushcontent', function () {
        if ($(this).is(':checked') === true) {
            body.addClass('menu-push-content');
            body.removeClass('menu-overlay');
        }

        return false;
    });

    $(document).on('change', '#menu-overlay', function () {
        if ($(this).is(':checked') === true) {
            body.removeClass('menu-push-content');
            body.addClass('menu-overlay');
        }

        return false;
    });


    /* back page navigation */
    $(document).on('click', '.back-btn', function () {
        window.history.back();
        return false;
    });


    /** center button click toggle **/
		$(document).on('click','.centerbutton .nav-link', function() {
        $(this).toggleClass('active');
    });

});


$(window).on('load', function () {
    setTimeout(function () {
        $('.loader-wrap').fadeOut('slow');
    }, 500);

    /* coverimg */
    $('.coverimg').each(function () {
        var imgpath = $(this).find('img');
        $(this).css('background-image', 'url(' + imgpath.attr('src') + ')');
        imgpath.hide();
    })

    
    /* url path on menu */
    var path = window.location.href; // because the 'href' property of the DOM element is the absolute path
    $(' .main-menu ul a').each(function () {
        if (this.href === path) {
            $(' .main-menu ul a').removeClass('active');
            $(this).addClass('active');
        }
    });

    /* main container min height */
    $('main').css('min-height', $(window).height());
	
    if ($('.header.position-fixed').length > 0) {
        $('main').css('padding-top', $('.header').outerHeight() + 10);
    }
    if ($('.footer').length > 0) {
        $('main').css('padding-bottom', $('.footer').outerHeight() + 10);
    }

    
});


$(window).on('scroll', function () {

    /* scroll from top and add class */
    if ($(document).scrollTop() > '10') {
        $('.header.position-fixed').addClass('active');
    } else {
        $('.header.position-fixed').removeClass('active');
    }
});


$(window).on('resize', function () {
    /* main container min height */
    $('main').css('min-height', $(window).height())
});
