/**
 * Construct a new SecretCodes Object.
 * @class A class for submitting Secret Codes and Pixie Passes
 * @param {object} config Configuration details
 * @return A new SecretCodes Class
 */
var SecretCodes = function(_config) {
	
	/**
	 * Private Variables
	 * @ignore
	 */
	var self = this,
		config = {
			classes: {
				loader : 'secret-codes-loading-swf'
			},
			calls : {
				codeRedemption : fairies.API.getCall('secretCode'),
				rewardMap : PATH.CDN +'/pixie-hollow/xml/code-reward-map.xml',
				loadingSWF : PATH.CDN + '/pixie-hollow/swf/loader.swf'
			},
			selectors : {
				codeInput : '#code-input',
				codeForm : '#code-form',
				playButton : '#success-play',
				submitButton : '#code-submit',
				successPopup : '.popup-secret-code-success',
				rewardDescription : '#reward-description',
				loaderContainer : '.secret-codes .loading-container'
			}
		},
		rewardMap = {},
		rewardDescription = $(config.selectors.rewardDescription),
		button = $(config.selectors.submitButton),
		codeInput = $(config.selectors.codeInput),
		form = $(config.selectors.codeForm),
		successPopup = $(config.selectors.successPopup),
		postTemplate = '<CouponRedemptionRequest><code>{code}</code></CouponRedemptionRequest>',
		rewardTemplate = 'You\'ve unlocked {item} for your fairies. {description} Fly in and check {location} for more details.'
		formReady = false;

	/**
	 * Construct a new SecretCodes Class
	 * @private
	 */
	function Constructor() {
		
		$.extend(true, config, _config);

		fairies.API.listen('whoAmI', function () {
			formReady = true;
		});
		form.submit(onFormSubmit);
		button.click(submitForm);
		$(config.selectors.playButton).click(onSuccesPlayClick);
		$.flashProxy.get(config.calls.rewardMap, onRewardMapLoaded);

		// Preload Loader
		setTimeout(function() {
			swfobject.embedSWF(config.calls.loadingSWF, config.classes.loader, '68', '68', '10', null, {}, { wmode: 'transparent' }, { });
		}, 3000);
	}

	/** 
	 * Removes the success overlay and shows the mini manager
	 */
	function onSuccesPlayClick(e) {
		e.preventDefault();
		e.stopPropagation();

		fairies.popup.toggle(successPopup, 'hide', function() {
			setTimeout(fairies.API.openMiniManager, 200);
		});
	}

	/** 
	 * Caches the secret code descriptions and images into a local map for fast lookups
	 * @param {xml} xml secret code reward map
	 */
	function onRewardMapLoaded(xml) {
		
		xml = $.parseXML(xml);

		$('reward', xml).each(function () {
			rewardMap[$(this).children('itemId').text()] = {
				'item' : $(this).children('name').text(),
				'description' : $(this).children('description').text(),
				'image' : $(this).children('image').text()
			};
		});
	}

	/** 
	 * Triggers form submit
	 * @param {event} click or keypress event
	 */
	function submitForm(e) {
		if(typeof e === 'object') {
			e.preventDefault();
			e.stopPropagation();
		}

		form.trigger('submit');
	}

	/** 
	 * Handles form submit event
	 * @param {object} event jQuery form submit event.
	 */
	function onFormSubmit(e) {
		e.preventDefault();

		if(!formReady) {
			return;
		}

		showLoading();

		formReady = false;
		$.formError.clear();
		$.flashProxy(config.calls.codeRedemption, {
			type : 'post',
			contentType : 'text/xml'
		}, postTemplate.replace(/{code}/, codeInput.val()), onCodeSubmitResponse);
	}

	/** 
	 * Handles response from submitting a code
	 * @param {object} xml XML response from submitting a code to web service.
	 */
	function onCodeSubmitResponse(xml) {
		var errorCode,
			errorCodeMap = {
				defaultMessage : 'Internal Error',
				AT_MAX_USES : 'You have already redeemed this secret code',
				ERROR_INVALID_PARMS : 'Invalid code',
				NO_FAIRY_ACTIVE : 'You need at least one Fairy to redeem a secret code.',
				CODE_ALREADY_USED : 'Oops! Looks like this code has already been used. Please try a different code.',
				USER_NOT_LOGGED_IN : forceLogin
			},
			itemId = 0,
			count = 0,
			description = rewardTemplate;

		function forceLogin() {
			fairies.API.simpleLogin(function () {
				fairies.API.closeMiniManager();
				submitForm();
			});
		}

		formReady = true;

		hideLoading();

		xml = $.parseXML(xml);

		if($('success:first', xml).text().toLowerCase() !== 'true') {
			errorCode = $(xml).find('error').attr('code');

			if(typeof errorCodeMap[errorCode] === 'function') {
				errorCodeMap[errorCode]();
			} else {
				$.formError.displayUnderElement(codeInput, errorCodeMap[errorCode] !== undefined ? errorCodeMap[errorCode] : errorCodeMap.defaultMessage);
			}
		} else {
			itemId = $('item_id:first', xml).text();
			count = $('count', xml).text();
			
			if(rewardMap[itemId]) {
				description = description.replace(/{item}/, count +' '+ rewardMap[itemId].item).replace(/{description}/, rewardMap[itemId].description);
			} else {
				description = description.replace(/{description}/, '');
			}
			if (itemId < 4000) {
				description = description.replace(/{item}/, 'a clothing item').replace(/{location}/, 'the wardrobe tab in your leaf journal');
			} else if (itemId < 8000) {
				description = description.replace(/{item}/, 'a home item').replace(/{location}/, 'the storage tab in your leaf journal');
			} else if ((itemId >= 22500) && (itemId < 23000)) {
				description = description.replace(/{item}/, 'Silly Sweets').replace(/{location}/, 'your pouch');
			} 
			else { 
				description = description.replace(/{item}/, 'an ingredient').replace(/{location}/, 'your pouch');
			}

			description = '<p>' + description + '</p>';

			// Fairy Errors
			var errorFairies = [];
			$('fairy error', xml).each(function(index, item) {
				if ($(item).attr('code') == 'ALREADY_OWNED') {
					
					if ( $.inArray( $(item).parent().attr('fairy_id'), errorFairies) != -1) {
						return;
					}

					errorFairies.push($(item).parent().attr('fairy_id'));

					description += '<p>';
					description += $(item).parent().find('name').text() + ' already has this shimmerific item!';
					description += '</p>';
				}
			});

			rewardDescription.html(description);

			fairies.popup.toggle(successPopup, 'show');
			codeInput.val('');
		}
	}

	/**
	 * Shows the Loading Info
	 * @private
	 */
	function showLoading() {

		// Change Button
		button.addClass('button-disabled');
		button.data('text', $(button).find('span').html());
		button.find('span').html('Loading');

		// Show Loading Animation
		$(config.selectors.loaderContainer).show();
	}

	/**
	 * Hides the Loading Info
	 * @private
	 */
	function hideLoading() {

		// Change Button
		button.removeClass('button-disabled');
		$(button).find('span').html(button.data('text'));

		// Hide Loading Animation
		$(config.selectors.loaderContainer).hide();
	}

	// Call the Constructor
	Constructor.call(self);
};