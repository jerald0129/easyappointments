/* ----------------------------------------------------------------------------
 * Easy!Appointments - Open Source Web Scheduler
 *
 * @package     EasyAppointments
 * @author      A.Tselegidis <alextselegidis@gmail.com>
 * @copyright   Copyright (c) Alex Tselegidis
 * @license     https://opensource.org/licenses/GPL-3.0 - GPLv3
 * @link        https://easyappointments.org
 * @since       v1.0.0
 * ---------------------------------------------------------------------------- */

/**
 * Booking page.
 *
 * This module implements the functionality of the booking page
 *
 * Old Name: FrontendBook
 */
App.Pages.Booking = (function () {
    /**
     * Contains terms and conditions consent.
     *
     * @type {Object}
     */
    let termsAndConditionsConsent;

    /**
     * Contains privacy policy consent.
     *
     * @type {Object}
     */
    let privacyPolicyConsent;

    /**
     * Determines the functionality of the page.
     *
     * @type {Boolean}
     */
    let manageMode = false;

    /**
     * Initialize the module.
     */
    function initialize() {
        if (App.Vars.display_cookie_notice) {
            cookieconsent.initialise({
                palette: {
                    popup: {
                        background: '#ffffffbd',
                        text: '#666666'
                    },
                    button: {
                        background: '#429a82',
                        text: '#ffffff'
                    }
                },
                content: {
                    message: App.Lang.website_using_cookies_to_ensure_best_experience,
                    dismiss: 'OK'
                }
            });

            $('.cc-link').replaceWith(
                $('<a/>', {
                    'data-toggle': 'modal',
                    'data-target': '#cookie-notice-modal',
                    'href': '#',
                    'class': 'cc-link',
                    'text': $('.cc-link').text()
                })
            );
        }

        manageMode = App.Vars.manage_mode;

        // Initialize page's components (tooltips, datepickers etc).
        tippy('[data-tippy-content]');

        const weekDayId = GeneralFunctions.getWeekDayId(GlobalVariables.firstWeekday);

        $('#select-date').datepicker({
            dateFormat: 'dd-mm-yy',
            firstDay: weekDayId,
            minDate: 0,
            defaultDate: moment().toDate(),

            dayNames: [
                App.Lang.sunday,
                App.Lang.monday,
                App.Lang.tuesday,
                App.Lang.wednesday,
                App.Lang.thursday,
                App.Lang.friday,
                App.Lang.saturday
            ],
            dayNamesShort: [
                App.Lang.sunday.substr(0, 3),
                App.Lang.monday.substr(0, 3),
                App.Lang.tuesday.substr(0, 3),
                App.Lang.wednesday.substr(0, 3),
                App.Lang.thursday.substr(0, 3),
                App.Lang.friday.substr(0, 3),
                App.Lang.saturday.substr(0, 3)
            ],
            dayNamesMin: [
                App.Lang.sunday.substr(0, 2),
                App.Lang.monday.substr(0, 2),
                App.Lang.tuesday.substr(0, 2),
                App.Lang.wednesday.substr(0, 2),
                App.Lang.thursday.substr(0, 2),
                App.Lang.friday.substr(0, 2),
                App.Lang.saturday.substr(0, 2)
            ],
            monthNames: [
                App.Lang.january,
                App.Lang.february,
                App.Lang.march,
                App.Lang.april,
                App.Lang.may,
                App.Lang.june,
                App.Lang.july,
                App.Lang.august,
                App.Lang.september,
                App.Lang.october,
                App.Lang.november,
                App.Lang.december
            ],
            prevText: App.Lang.previous,
            nextText: App.Lang.next,
            currentText: App.Lang.now,
            closeText: App.Lang.close,

            onSelect: function (dateText, instance) {
                App.Http.Booking.getAvailableHours(moment($(this).datepicker('getDate')).format('YYYY-MM-DD'));
                updateConfirmFrame();
            },

            onChangeMonthYear: (year, month) => {
                const currentDate = new Date(year, month - 1, 1);

                App.Http.Booking.getUnavailableDates(
                    $('#select-provider').val(),
                    $('#select-service').val(),
                    moment(currentDate).format('YYYY-MM-DD')
                );
            }
        });

        $('#select-timezone').val(Intl.DateTimeFormat().resolvedOptions().timeZone);

        // Bind the event handlers (might not be necessary every time we use this class).
        bindEventHandlers();

        // If the manage mode is true, the appointments data should be loaded by default.
        if (manageMode) {
            applyAppointmentData(
                GlobalVariables.appointmentData,
                GlobalVariables.providerData,
                GlobalVariables.customerData
            );
        } else {
            const $selectProvider = $('#select-provider');
            const $selectService = $('#select-service');

            // Check if a specific service was selected (via URL parameter).
            const selectedServiceId = GeneralFunctions.getUrlParameter(location.href, 'service');

            if (selectedServiceId && $selectService.find('option[value="' + selectedServiceId + '"]').length > 0) {
                $selectService.val(selectedServiceId);
            }

            $selectService.trigger('change'); // Load the available hours.

            // Check if a specific provider was selected.
            const selectedProviderId = GeneralFunctions.getUrlParameter(location.href, 'provider');

            if (selectedProviderId && $selectProvider.find('option[value="' + selectedProviderId + '"]').length === 0) {
                // Select a service of this provider in order to make the provider available in the select box.
                for (const index in GlobalVariables.availableProviders) {
                    const provider = GlobalVariables.availableProviders[index];

                    if (provider.id === selectedProviderId && provider.services.length > 0) {
                        $selectService.val(provider.services[0]).trigger('change');
                    }
                }
            }

            if (selectedProviderId && $selectProvider.find('option[value="' + selectedProviderId + '"]').length > 0) {
                $selectProvider.val(selectedProviderId).trigger('change');
            }
        }
    }

    /**
     * Bind the event handlers.
     */
    function bindEventHandlers() {
        /**
         * Event: Timezone "Changed"
         */
        $('#select-timezone').on('change', () => {
            const date = $('#select-date').datepicker('getDate');

            if (!date) {
                return;
            }

            App.Http.Booking.getAvailableHours(moment(date).format('YYYY-MM-DD'));

            updateConfirmFrame();
        });

        /**
         * Event: Selected Provider "Changed"
         *
         * Whenever the provider changes the available appointment date - time periods must be updated.
         */
        $('#select-provider').on('change', (event) => {
            App.Http.Booking.getUnavailableDates(
                $(event.target).val(),
                $('#select-service').val(),
                moment($('#select-date').datepicker('getDate')).format('YYYY-MM-DD')
            );
            updateConfirmFrame();
        });

        /**
         * Event: Selected Service "Changed"
         *
         * When the user clicks on a service, its available providers should
         * become visible.
         */
        $('#select-service').on('change', (event) => {
            const serviceId = $('#select-service').val();

            $('#select-provider').empty();

            GlobalVariables.availableProviders.forEach((provider) => {
                // If the current provider is able to provide the selected service, add him to the list box.
                const canServeService =
                    provider.services.filter((providerServiceId) => Number(providerServiceId) === Number(serviceId))
                        .length > 0;

                if (canServeService) {
                    $('#select-provider').append(
                        new Option(provider.first_name + ' ' + provider.last_name, provider.id)
                    );
                }
            });

            // Add the "Any Provider" entry.
            if ($('#select-provider option').length >= 1 && GlobalVariables.displayAnyProvider === '1') {
                $('#select-provider').prepend(
                    new Option('- ' + App.Lang.any_provider + ' -', 'any-provider', true, true)
                );
            }

            App.Http.Booking.getUnavailableDates(
                $('#select-provider').val(),
                $(event.target).val(),
                moment($('#select-date').datepicker('getDate')).format('YYYY-MM-DD')
            );

            updateConfirmFrame();

            updateServiceDescription(serviceId);
        });

        /**
         * Event: Next Step Button "Clicked"
         *
         * This handler is triggered every time the user pressed the "next" button on the book wizard.
         * Some special tasks might be performed, depending on the current wizard step.
         */
        $('.button-next').on('click', (event) => {
            // If we are on the first step and there is not provider selected do not continue with the next step.
            if ($(event.target).attr('data-step_index') === '1' && !$('#select-provider').val()) {
                return;
            }

            // If we are on the 2nd tab then the user should have an appointment hour selected.
            if ($(event.target).attr('data-step_index') === '2') {
                if (!$('.selected-hour').length) {
                    if (!$('#select-hour-prompt').length) {
                        $('<div/>', {
                            'id': 'select-hour-prompt',
                            'class': 'text-danger mb-4',
                            'text': App.Lang.appointment_hour_missing
                        }).prependTo('#available-hours');
                    }
                    return;
                }
            }

            // If we are on the 3rd tab then we will need to validate the user's input before proceeding to the next
            // step.
            if ($(event.target).attr('data-step_index') === '3') {
                if (!validateCustomerForm()) {
                    return; // Validation failed, do not continue.
                } else {
                    updateConfirmFrame();

                    const $acceptToTermsAndConditions = $('#accept-to-terms-and-conditions');
                    if ($acceptToTermsAndConditions.length && $acceptToTermsAndConditions.prop('checked') === true) {
                        const newTermsAndConditionsConsent = {
                            first_name: $('#first-name').val(),
                            last_name: $('#last-name').val(),
                            email: $('#email').val(),
                            type: 'terms-and-conditions'
                        };

                        if (
                            JSON.stringify(newTermsAndConditionsConsent) !== JSON.stringify(termsAndConditionsConsent)
                        ) {
                            termsAndConditionsConsent = newTermsAndConditionsConsent;
                            App.Http.Booking.saveConsent(termsAndConditionsConsent);
                        }
                    }

                    const $acceptToPrivacyPolicy = $('#accept-to-privacy-policy');
                    if ($acceptToPrivacyPolicy.length && $acceptToPrivacyPolicy.prop('checked') === true) {
                        const newPrivacyPolicyConsent = {
                            first_name: $('#first-name').val(),
                            last_name: $('#last-name').val(),
                            email: $('#email').val(),
                            type: 'privacy-policy'
                        };

                        if (JSON.stringify(newPrivacyPolicyConsent) !== JSON.stringify(privacyPolicyConsent)) {
                            privacyPolicyConsent = newPrivacyPolicyConsent;
                            App.Http.Booking.saveConsent(privacyPolicyConsent);
                        }
                    }
                }
            }

            // Display the next step tab (uses jquery animation effect).
            const nextTabIndex = parseInt($(event.target).attr('data-step_index')) + 1;

            $(event.target)
                .parents()
                .eq(1)
                .hide('fade', () => {
                    $('.active-step').removeClass('active-step');
                    $('#step-' + nextTabIndex).addClass('active-step');
                    $('#wizard-frame-' + nextTabIndex).show('fade');
                });
        });

        /**
         * Event: Back Step Button "Clicked"
         *
         * This handler is triggered every time the user pressed the "back" button on the
         * book wizard.
         */
        $('.button-back').on('click', (event) => {
            const prevTabIndex = parseInt($(event.target).attr('data-step_index')) - 1;

            $(event.target)
                .parents()
                .eq(1)
                .hide('fade', () => {
                    $('.active-step').removeClass('active-step');
                    $('#step-' + prevTabIndex).addClass('active-step');
                    $('#wizard-frame-' + prevTabIndex).show('fade');
                });
        });

        /**
         * Event: Available Hour "Click"
         *
         * Triggered whenever the user clicks on an available hour
         * for his appointment.
         */
        $('#available-hours').on('click', '.available-hour', (event) => {
            $('.selected-hour').removeClass('selected-hour');
            $(event.target).addClass('selected-hour');
            updateConfirmFrame();
        });

        if (manageMode) {
            /**
             * Event: Cancel Appointment Button "Click"
             *
             * When the user clicks the "Cancel" button this form is going to be submitted. We need
             * the user to confirm this action because once the appointment is cancelled, it will be
             * delete from the database.
             *
             * @param {jQuery.Event} event
             */
            $('#cancel-appointment').on('click', () => {
                const buttons = [
                    {
                        text: App.Lang.cancel,
                        click: function () {
                            $('#message-box').dialog('close');
                        }
                    },
                    {
                        text: 'OK',
                        click: function () {
                            if ($('#cancel-reason').val() === '') {
                                $('#cancel-reason').css('border', '2px solid #DC3545');
                                return;
                            }
                            $('#cancel-appointment-form textarea').val($('#cancel-reason').val());
                            $('#cancel-appointment-form').submit();
                        }
                    }
                ];

                App.Utils.Message.show(
                    App.Lang.cancel_appointment_title,
                    App.Lang.write_appointment_removal_reason,
                    buttons
                );

                $('<textarea/>', {
                    'class': 'form-control',
                    'id': 'cancel-reason',
                    'rows': '3',
                    'css': {
                        'width': '100%'
                    }
                }).appendTo('#message-box');

                return false;
            });

            $('#delete-personal-information').on('click', () => {
                const buttons = [
                    {
                        text: App.Lang.cancel,
                        click: () => {
                            $('#message-box').dialog('close');
                        }
                    },
                    {
                        text: App.Lang.delete,
                        click: () => {
                            App.Http.Booking.deletePersonalInformation(GlobalVariables.customerToken);
                        }
                    }
                ];

                App.Utils.Message.show(
                    App.Lang.delete_personal_information,
                    App.Lang.delete_personal_information_prompt,
                    buttons
                );
            });
        }

        /**
         * Event: Book Appointment Form "Submit"
         *
         * Before the form is submitted to the server we need to make sure that
         * in the meantime the selected appointment date/time wasn't reserved by
         * another customer or event.
         *
         * @param {jQuery.Event} event
         */
        $('#book-appointment-submit').on('click', () => {
            App.Http.Booking.registerAppointment();
        });

        /**
         * Event: Refresh captcha image.
         */
        $('.captcha-title button').on('click', () => {
            $('.captcha-image').attr('src', GlobalVariables.baseUrl + '/index.php/captcha?' + Date.now());
        });

        $('#select-date').on('mousedown', '.ui-datepicker-calendar td', () => {
            setTimeout(() => {
                App.Http.Booking.applyPreviousUnavailableDates(); // New jQuery UI version will replace the td elements.
            }, 300); // There is no draw event unfortunately.
        });
    }

    /**
     * This function validates the customer's data input. The user cannot continue
     * without passing all the validation checks.
     *
     * @return {Boolean} Returns the validation result.
     */
    function validateCustomerForm() {
        $('#wizard-frame-3 .is-invalid').removeClass('is-invalid');
        $('#wizard-frame-3 label.text-danger').removeClass('text-danger');

        try {
            // Validate required fields.
            let missingRequiredField = false;

            $('.required').each((index, requiredField) => {
                if (!$(requiredField).val()) {
                    $(requiredField).parents('.form-group').addClass('is-invalid');
                    missingRequiredField = true;
                }
            });

            if (missingRequiredField) {
                throw new Error(App.Lang.fields_are_required);
            }

            const $acceptToTermsAndConditions = $('#accept-to-terms-and-conditions');
            if ($acceptToTermsAndConditions.length && !$acceptToTermsAndConditions.prop('checked')) {
                $acceptToTermsAndConditions.parents('.form-check').addClass('text-danger');
                throw new Error(App.Lang.fields_are_required);
            }

            const $acceptToPrivacyPolicy = $('#accept-to-privacy-policy');
            if ($acceptToPrivacyPolicy.length && !$acceptToPrivacyPolicy.prop('checked')) {
                $acceptToPrivacyPolicy.parents('.form-check').addClass('text-danger');
                throw new Error(App.Lang.fields_are_required);
            }

            // Validate email address.
            if ($('#email').val() && !GeneralFunctions.validateEmail($('#email').val())) {
                $('#email').parents('.form-group').addClass('is-invalid');
                throw new Error(App.Lang.invalid_email);
            }

            return true;
        } catch (error) {
            $('#form-message').text(error.message);
            return false;
        }
    }

    /**
     * Every time this function is executed, it updates the confirmation page with the latest
     * customer settings and input for the appointment booking.
     */
    function updateConfirmFrame() {
        if ($('.selected-hour').text() === '') {
            return;
        }

        // Appointment Details
        let selectedDate = $('#select-date').datepicker('getDate');

        if (selectedDate !== null) {
            selectedDate = App.Utils.Date.format(selectedDate, App.Vars.date_format, App.Vars.time_format);
        }

        const serviceId = $('#select-service').val();
        let servicePrice = '';
        let serviceCurrency = '';

        App.Vars.available_services.forEach((service) => {
            if (Number(service.id) === Number(serviceId) && Number(service.price) > 0) {
                servicePrice = service.price;
                serviceCurrency = service.currency;
                return false; // Break loop
            }
        });

        $('#appointment-details').empty();

        $('<div/>', {
            'html': [
                $('<h4/>', {
                    'text': App.Lang.appointment
                }),
                $('<p/>', {
                    'html': [
                        $('<span/>', {
                            'text': App.Lang.service + ': ' + $('#select-service option:selected').text()
                        }),
                        $('<br/>'),
                        $('<span/>', {
                            'text': App.Lang.provider + ': ' + $('#select-provider option:selected').text()
                        }),
                        $('<br/>'),
                        $('<span/>', {
                            'text': App.Lang.start + ': ' + selectedDate + ' ' + $('.selected-hour').text()
                        }),
                        $('<br/>'),
                        $('<span/>', {
                            'text': App.Lang.timezone + ': ' + $('#select-timezone option:selected').text()
                        }),
                        $('<br/>'),
                        $('<span/>', {
                            'text': App.Lang.price + ': ' + servicePrice + ' ' + serviceCurrency,
                            'prop': {
                                'hidden': !servicePrice
                            }
                        })
                    ]
                })
            ]
        }).appendTo('#appointment-details');

        // Customer Details
        const firstName = GeneralFunctions.escapeHtml($('#first-name').val());
        const lastName = GeneralFunctions.escapeHtml($('#last-name').val());
        const phoneNumber = GeneralFunctions.escapeHtml($('#phone-number').val());
        const email = GeneralFunctions.escapeHtml($('#email').val());
        const address = GeneralFunctions.escapeHtml($('#address').val());
        const city = GeneralFunctions.escapeHtml($('#city').val());
        const zipCode = GeneralFunctions.escapeHtml($('#zip-code').val());

        $('#customer-details').empty();

        $('<div/>', {
            'html': [
                $('<h4/>)', {
                    'text': App.Lang.customer
                }),
                $('<p/>', {
                    'html': [
                        $('<span/>', {
                            'text': App.Lang.customer + ': ' + firstName + ' ' + lastName
                        }),
                        $('<br/>'),
                        $('<span/>', {
                            'text': App.Lang.phone_number + ': ' + phoneNumber
                        }),
                        $('<br/>'),
                        $('<span/>', {
                            'text': App.Lang.email + ': ' + email
                        }),
                        $('<br/>'),
                        $('<span/>', {
                            'text': address ? App.Lang.address + ': ' + address : ''
                        }),
                        $('<br/>'),
                        $('<span/>', {
                            'text': city ? App.Lang.city + ': ' + city : ''
                        }),
                        $('<br/>'),
                        $('<span/>', {
                            'text': zipCode ? App.Lang.zip_code + ': ' + zipCode : ''
                        }),
                        $('<br/>')
                    ]
                })
            ]
        }).appendTo('#customer-details');

        // Update appointment form data for submission to server when the user confirms the appointment.
        const data = {};

        data.customer = {
            last_name: $('#last-name').val(),
            first_name: $('#first-name').val(),
            email: $('#email').val(),
            phone_number: $('#phone-number').val(),
            address: $('#address').val(),
            city: $('#city').val(),
            zip_code: $('#zip-code').val(),
            timezone: $('#select-timezone').val()
        };

        data.appointment = {
            start_datetime:
                moment($('#select-date').datepicker('getDate')).format('YYYY-MM-DD') +
                ' ' +
                moment($('.selected-hour').data('value'), 'HH:mm').format('HH:mm') +
                ':00',
            end_datetime: calculateEndDatetime(),
            notes: $('#notes').val(),
            is_unavailable: false,
            id_users_provider: $('#select-provider').val(),
            id_services: $('#select-service').val()
        };

        data.manage_mode = manageMode;

        if (manageMode) {
            data.appointment.id = GlobalVariables.appointmentData.id;
            data.customer.id = GlobalVariables.customerData.id;
        }
        $('input[name="csrfToken"]').val(GlobalVariables.csrfToken);
        $('input[name="post_data"]').val(JSON.stringify(data));
    }

    /**
     * This method calculates the end datetime of the current appointment.
     *
     * End datetime is depending on the service and start datetime fields.
     *
     * @return {String} Returns the end datetime in string format.
     */
    function calculateEndDatetime() {
        // Find selected service duration.
        const serviceId = $('#select-service').val();

        const service = App.Vars.available_services.find(
            (availableService) => Number(availableService.id) === Number(serviceId)
        );

        // Add the duration to the start datetime.
        const selectedDate = moment($('#select-date').datepicker('getDate')).format('YYYY-MM-DD');

        const selectedHour = $('.selected-hour').data('value'); // HH:mm

        const startMoment = moment(selectedDate + ' ' + selectedHour);

        let endMoment;

        if (service.duration && startMoment) {
            endMoment = startMoment.clone().add({'minutes': parseInt(service.duration)});
        } else {
            endMoment = moment();
        }

        return endMoment.format('YYYY-MM-DD HH:mm:ss');
    }

    /**
     * This method applies the appointment's data to the wizard so
     * that the user can start making changes on an existing record.
     *
     * @param {Object} appointment Selected appointment's data.
     * @param {Object} provider Selected provider's data.
     * @param {Object} customer Selected customer's data.
     *
     * @return {Boolean} Returns the operation result.
     */
    function applyAppointmentData(appointment, provider, customer) {
        try {
            // Select Service & Provider
            $('#select-service').val(appointment.id_services).trigger('change');
            $('#select-provider').val(appointment.id_users_provider);

            // Set Appointment Date
            const startMoment = moment(appointment.start_datetime);
            $('#select-date').datepicker('setDate', startMoment.toDate());
            App.Http.Booking.getAvailableHours(startMoment.format('YYYY-MM-DD'));

            // Apply Customer's Data
            $('#last-name').val(customer.last_name);
            $('#first-name').val(customer.first_name);
            $('#email').val(customer.email);
            $('#phone-number').val(customer.phone_number);
            $('#address').val(customer.address);
            $('#city').val(customer.city);
            $('#zip-code').val(customer.zip_code);
            if (customer.timezone) {
                $('#select-timezone').val(customer.timezone);
            }
            const appointmentNotes = appointment.notes !== null ? appointment.notes : '';
            $('#notes').val(appointmentNotes);

            updateConfirmFrame();

            return true;
        } catch (exc) {
            return false;
        }
    }

    /**
     * This method updates a div's HTML content with a brief description of the
     * user selected service (only if available in db). This is useful for the
     * customers upon selecting the correct service.
     *
     * @param {Number} serviceId The selected service record id.
     */
    function updateServiceDescription(serviceId) {
        const $serviceDescription = $('#service-description');

        $serviceDescription.empty();

        const service = App.Vars.available_services.find(function (availableService) {
            return Number(availableService.id) === Number(serviceId);
        });

        if (!service) {
            return;
        }

        $('<strong/>', {
            'text': service.name
        }).appendTo($serviceDescription);

        if (service.description) {
            $('<br/>').appendTo($serviceDescription);

            $('<span/>', {
                'html': GeneralFunctions.escapeHtml(service.description).replaceAll('\n', '<br/>')
            }).appendTo($serviceDescription);
        }

        if (service.duration || Number(service.price) > 0 || service.location) {
            $('<br/>').appendTo($serviceDescription);
        }

        if (service.duration) {
            $('<span/>', {
                'text': '[' + App.Lang.duration + ' ' + service.duration + ' ' + App.Lang.minutes + ']'
            }).appendTo($serviceDescription);
        }

        if (Number(service.price) > 0) {
            $('<span/>', {
                'text': '[' + App.Lang.price + ' ' + service.price + ' ' + service.currency + ']'
            }).appendTo($serviceDescription);
        }

        if (service.location) {
            $('<span/>', {
                'text': '[' + App.Lang.location + ' ' + service.location + ']'
            }).appendTo($serviceDescription);
        }
    }

    document.addEventListener('DOMContentLoaded', initialize);

    return {
        manageMode,
        initialize,
        updateConfirmFrame
    };
})();
