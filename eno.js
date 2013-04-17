
(function () {
    "use strict";
    var currentVideo = -1, // -1 means no current video, otherwise this variable is the index of the video
        playing = false,
        allLoaded = false, // Are all videos loaded? Not currently used.
        $videos,
        $still,
        numVideos,
        numLoaded = 0,
        videoClass = 'videoBg-video',
        $videoBgContainer,
        nowLoading, // index of the video that is being loaded
        $nowLoadingElem, // jQuery element for the video that is being loaded. Not currently used.
        numNeeded = 2, // This is the number of videos we need to load before we start playing
        loadingVideo;

    /* debouncedresize: special jQuery event that happens once after a window resize
    * https://github.com/louisremi/jquery-smartresize */
    (function(a){var d=a.event,b,c;b=d.special.debouncedresize={setup:function(){a(this).on("resize",b.handler)},teardown:function(){a(this).off("resize",b.handler)},handler:function(a,f){var g=this,h=arguments,e=function(){a.type="debouncedresize";d.dispatch.apply(g,h)};c&&clearTimeout(c);f?e():c=setTimeout(e,b.threshold)},threshold:150}})(jQuery);


    // TODO: remove this console.log fix, as well as console.log calls, after deployment is tested and
    //found to be successful.
    // Avoid `console` errors in browsers that lack a console.
    (function() {
        var method;
        var noop = function () {};
        var methods = [
            'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
            'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
            'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
            'timeStamp', 'trace', 'warn'
        ];
        var length = methods.length;
        var console = (window.console = window.console || {});

        while (length--) {
            method = methods[length];

            // Only stub undefined methods.
            if (!console[method]) {
                console[method] = noop;
            }
        }
    }());

    function full_bleed(boxWidth, boxHeight, imgWidth, imgHeight) {
        // Loosely based on stackoverflow.com/questions/5399568/full-bleed-image-resize-calculation
        // Calculate new height and width
        var initW = imgWidth,
            initH = imgHeight,
            ratio = initH / initW,
            imgLeft,
            imgTop;

        imgWidth = boxWidth;
        imgHeight = boxWidth * ratio;

        if (imgHeight < boxHeight) {
            imgHeight = boxHeight;
            imgWidth = imgHeight / ratio;
        }

        imgLeft = (boxWidth - imgWidth) / 2;
        imgTop = (boxHeight - imgHeight) / 2;

        //  Return new size
        return {
            width: imgWidth,
            height: imgHeight,
            left: imgLeft,
            top: imgTop
        };
    }
    // Record the dimensions of the video before we resize them, so that we can adjust size correctly later.
    // Be sure to call recordDimensions on an element before calling resizeToFit on that element. Don't call recordDimensions again after resizing.
    function recordDimensions($elem) {
        $elem.each(function () {
            var $this = $(this);
            // If height and width attributes are available, record those - they'll be accurate even if the resource hasn't loaded or CSS is doing something funky.
            if (!isNaN($this.attr('height')) && !isNaN($this.attr('width'))) {
                $this.data('default-height', $this.attr('height'));
                $this.data('default-width', $this.attr('width'));
            } else {
                $this.data('default-height', $this.height());
                $this.data('default-width', $this.width());
            }
        });
    }
    // Rezise the videos so that they are as large as the window or larger, keeping aspect ratio intact.

    function resizeToFit($element) {
        var dimensions;
        $element.each(function () {
            var $this = $(this);
            dimensions = full_bleed($videoBgContainer.width(), $videoBgContainer.height(), $this.data('default-width'), $this.data('default-height'));
            $this.width(dimensions.width).height(dimensions.height).css('top', dimensions.top).css('left', dimensions.left);
        });
    }

    // On document.ready, resize the images. Don't load videos yet, because doing so might block more important resources like fonts.
    $(document).ready(function () {
        $still = $('#videoBg-still');
        $videoBgContainer = $('.videoBg-videos');
        recordDimensions($still);
        resizeToFit($still);
        $(window).on('debouncedresize', function () {
            resizeToFit($still);
        });
    });

    function playVideo(index) {
        var videoElem = $videos.eq(index).get([0]),
        $oldVideo = $('.' + videoClass + '.active');
        console.log('Playing ' + index);
        $videos.eq(index).addClass('active');
        $oldVideo.removeClass('active');
        videoElem.play();
    }
    function startPlaying() {
        currentVideo = 0;
        $('#videoBg-still').removeClass('active');
        playVideo(0);
        playing = true;
    }

    function countLoaded() {
        /* We could use the readyState attribute, but this subject to change. It might be 4 for a while 
            (have_enough_data) and then drop back to 2 or 3. We're not going to pull the video out of rotation if
            the browser changes its mind about this. So, we're setting this loaded value because we know that it won't
            change after canplaythrough fires. */
        var loadedCount = 0;
        $($videos).each(function () {
            if ($(this).attr('data-loaded') === 'true') {
                loadedCount += 1;
            }
        });
        return loadedCount;
    }

    function doneLoading(elem) {
        var $elem = $(elem),
            videoIndex = $('.' + videoClass).index($(elem));
        if ($elem.attr('data-loaded') === 'true') {
            return;
        }
        $elem.attr('data-loaded', 'true');
        numLoaded = countLoaded();
        console.log('Done loading video ' + videoIndex);
        console.log('numLoaded is now ' + numLoaded);
        recordDimensions($elem);
        resizeToFit($elem);

        $elem.on('ended', function () {
            currentVideo += 1;
            if ((currentVideo + 1) > countLoaded()) { // Don't forget that numLoaded is 1-indexed, but currentVideo is 0-indexed.
                currentVideo = 0;
            }
            this.currentTime = 0;
            this.pause();
            playVideo(currentVideo);
        });

        if ((videoIndex + 1 < numVideos) && (nowLoading <= videoIndex)) {
            nowLoading = videoIndex + 1;
            $nowLoadingElem = loadVideo(nowLoading);
        }

        if ((numLoaded >= numNeeded) && !playing) {
            startPlaying();
        }

        if (numLoaded >= numVideos) {
            allLoaded = true;
        }
    }

    function loadVideo(index) {
        // bgVideos is a global output by a PHP file.
        var loadingVideoString = '',
            loadingVideo = bgVideos[index],
            $videoElem;
        console.log('loading video ' + index);

        loadingVideoString += '<video class="' + videoClass + '" muted preload="auto" data-loaded="false">';
        if (loadingVideo.video_mp4) {
            loadingVideoString += '<source src="' + loadingVideo.video_mp4 + '" type="video/mp4">';
        }
        if (loadingVideo.video_ogv) {
            loadingVideoString += '<source src="' + loadingVideo.video_ogv + '" type="video/ogg">';
        }
        if (loadingVideo.video_webm) {
            loadingVideoString += '<source src="' + loadingVideo.video_webm + '" type="video/webm">';
        }
        loadingVideoString += '</video>';
        $videoElem = $(loadingVideoString).appendTo($videoBgContainer);
        $videos = $('video.' + videoClass);
        if ($videoElem.get([0]).addEventListener) {
            $videoElem.get([0]).addEventListener('canplaythrough', function () {  
                doneLoading(this);
            });
        }
        return $videoElem;
    }

    // Load the videos, then begin playing.
    $(window).load(function () {
        // bgVideos is a global variable that's output on page-home.php.
        if (typeof bgVideos === 'undefined') {
            return;
        }
        numVideos = bgVideos.length;
        // Load the videos in order.
        nowLoading = 0;
        $nowLoadingElem = loadVideo(0);
        $(window).on('debouncedresize', function () {
            resizeToFit($still);
            resizeToFit(($videos).filter('video[data-loaded="true"]'));
        });
    });

})();
