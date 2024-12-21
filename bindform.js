(function ($) {
    $.fn.bindForm = function (bindingObject, options = {}) {
        const $form = this, id = $form.attr('id');
        const localStorageFormKey = `${id}_bindFormHistory`;

        if ($form.data('bindFormInitialized')) {
            console.warn(`Form "${id || $form.attr('class')}" is already bound. Destroy it before reinitializing.`);
            return;
        }

        $form.data('bindFormInitialized', true);

        bindingObject = typeof bindingObject === 'object' && bindingObject ? bindingObject : {};

        const defaultOptions = {
            debounceTime: 1000,
            validateOnChange: false,
            allowUpdateOnFailed: true,
            validators: {},
            readOnly: false,
            defaultValues: {},
            enableMutationObserver: true,
            historyLimit : 10,
            validationClass: 'is-invalid', // Default invalid class
            hooks: {
                onFieldChange: null,
                onFormUpdate: null,
                onObjectUpdate: null,
                onValidationFail: null,
                onFormSubmit: null,
                handleFormSubmission: async () => true,
                afterSubmit: null,
                handleValidation: (field, isValid, validationClass) => {
                    if (isValid) {
                        field.removeClass(validationClass);
                    } else {
                        field.addClass(validationClass);
                    }
                },
            },
            oneWay: false,
        };
        const settings = $.extend(true, {}, defaultOptions, options);

        const debounce = (func, wait) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        };

        const getNestedValue = (obj, path) => path.split('.').reduce((current, key) => current?.[key], obj);

        const $fields = $form.find('[name]');
        
        const updateForm = () => {
            $fields.each(function () {
                const $field = $(this);
                const name = $field.attr('name');
                const value = getNestedValue(bindingObject, name) ?? settings.defaultValues[name];
                const fieldType = $field.prop('type');

                const isValid = validateField(name, value);
                settings.hooks.handleValidation($field, isValid, settings.validationClass);
            
                if (!isValid && settings.validateOnChange && !settings.allowUpdateOnFailed) return;

                switch (fieldType) {
                    case 'checkbox':
                        $field.prop('checked', Boolean(value));
                        break;
                    case 'radio':
                        $field.prop('checked', $field.val() === String(value));
                        break;
                    case 'select-one':
                    case 'select-multiple':
                        $field.val(value || '').trigger('change');
                        break;
                    default:
                        $field.val(value || '');
                }
            });
        };

        const validateField = (name, value) => {
            const validator = settings.validators[name];
            if (validator && !validator(value)) {
                settings.hooks.onValidationFail?.(name, value);
                return false;
            }
            return true;
        };
        const recordHistory = (() => {
            // Wrap recordHistory to limit repeated writes within a short timeframe.
            let lastRecordedState = null;
            let lastRecordedTime = 0;
        
            return () => {
                const currentState = JSON.stringify(bindingObject);
                const now = Date.now();
        
                // Record only if the state has changed or a reasonable time has passed.
                if (currentState !== lastRecordedState || now - lastRecordedTime > 500) {
                    let history = JSON.parse(localStorage.getItem(localStorageFormKey) || '[]');
                    history.push({
                        state: currentState,
                        timestamp: new Date().toISOString(),
                    });

                    // Check and enforce the storage limit.
                    const historyLimit = settings.historyLimit || 10; // Default limit to 50 if not set in settings.
                    if (history.length > historyLimit) {
                        // Slice the history to keep only the most recent entries.
                        history = history.slice(-historyLimit);
                    }

                    localStorage.setItem(localStorageFormKey, JSON.stringify(history));
                    lastRecordedState = currentState;
                    lastRecordedTime = now;
                }
            };
        })();
        
        const updateObject = (name, value, isCheckbox = false) => {
            const finalValue = isCheckbox ? Boolean(value) : value;
        
            // Use `setNestedValue` to update the object only if the value differs.
            if(setNestedValue(bindingObject, name, finalValue)){

                // Trigger hooks only once per actual update.
                if(settings.autoSave == 0){
                    recordHistory();
                }
                settings.hooks.onObjectUpdate?.(bindingObject);
            }
        };
        
        const setNestedValue = (obj, path, value) => {
            if (!obj || typeof obj !== 'object' || typeof path !== 'string') {
                throw new Error('Invalid arguments');
            }
        
            const keys = path.split('.');
            const lastKey = keys.pop();
        
            const target = keys.reduce((current, key) => {
                if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                return current[key];
            }, obj);
        
            // Only update if the value differs.
            if (target[lastKey] !== value) {
                target[lastKey] = value;
                return true;
            }
            return false;
        };
        
        const handleInputChange = debounce(($field, event) => {
            const name = $field.attr('name');
            if (!name) return;
        
            const value = $field.is(':checkbox') ? $field.prop('checked') : $field.val();
            const isValid = validateField(name, value);
            settings.hooks.handleValidation($field, isValid, settings.validationClass);
        
            if (!isValid && settings.validateOnChange && !settings.allowUpdateOnFailed) return;
        
            // Update the object only once during the debounce cycle.
            if (event) {
                updateObject(name, value, $field.is(':checkbox'));
            }
        
            settings.hooks.onFieldChange?.(name, value);
        }, settings.debounceTime);
        
        $form.on('input change', '[name]', function (event) {
            // Debounce event handling to prevent redundant calls.
            handleInputChange($(this), event);
        });
        
        if (!settings.oneWay) {
            const proxy = new Proxy(bindingObject, {
                set(target, prop, value) {
                    if (target[prop] !== value) {
                        target[prop] = value; // Update the proxy target.
                        const $field = $fields.filter(`[name="${prop}"]`);
        
                        if ($field.is(':checkbox')) {
                            $field.prop('checked', Boolean(value));
                        } else {
                            $field.val(value);
                        }
        
                        // Prevent circular updates by bypassing the `input`/`change` event.
                        updateObject(prop, value, $field.is(':checkbox'));
                    }
                    return true;
                },
            });
        
            bindingObject = proxy;
        }
        
        updateForm();

        if (settings.enableMutationObserver) {
            const throttledMutationHandler = debounce(() => {
                $fields.off('input change').on('input change', handleInputChange);
            }, 200);

            const observer = new MutationObserver((mutations) => {
                if (mutations.some(mutation => Array.from(mutation.addedNodes).some(node => node.matches?.('[name]')))) {
                    throttledMutationHandler();
                }
            });
            observer.observe($form[0], { childList: true, subtree: true });
        }

        if (settings.readOnly) {
            $fields.prop('disabled', true);
        }

        const validateForm = () => {
            return $fields.toArray().every((field) => {
                const $field = $(field);
                const name = $field.attr('name');
                return validateField(name, $field.val());
            });
        };

        let autoSaveInterval = null;

        if (settings.autoSave > 0) {
            autoSaveInterval = setInterval(() => {
                console.log('Auto-saving form...');
                recordHistory();
            }, settings.autoSave * 60 * 1000);
        }


        $form.on('submit', async function (e) {
            e.preventDefault();

            if (!validateForm()) return;

            const shouldSubmit = await settings.hooks.onFormSubmit?.(bindingObject, e);
            if (shouldSubmit === false) return;

            const result = await settings.hooks.handleFormSubmission(bindingObject, e);
            settings.hooks.afterSubmit?.(result, bindingObject, e);
        });

        $form.data('importState', (newState) => {
            Object.assign(bindingObject, newState);
            updateForm();
        });

        $form.data('exportState', () => ({ ...bindingObject }));

        $form.data('bindFormDestroy', () => {
            $fields.off('input change');
            $form.off('submit');
            observer?.disconnect?.();
            if(autoSaveInterval) clearInterval(autoSaveInterval);
            $form.removeData('bindFormInitialized').removeData('bindFormDestroy');
        });
        

        $form.data('restoreHistory', (timestamp) => {
            const history = JSON.parse(localStorage.getItem(localStorageFormKey) || '[]');
            const record = history.find(h => h.timestamp === timestamp);
            if (record) {
                Object.assign(bindingObject, JSON.parse(record.state));
                updateForm();
            } else {
                console.warn('No history found for the given timestamp.');
            }
        });

        $form.data('getHistory', () => {
            const history = JSON.parse(localStorage.getItem(localStorageFormKey) || '[]');
            return history.map(h => h.timestamp);
        });

        $form.data('getProxy', () => proxy || bindingObject);

        return bindingObject;
    };

    $.fn.unbindForm = function () {
        const destroyFn = this.data('bindFormDestroy');
        if (destroyFn) destroyFn();
        else console.warn(`Form "${this.attr('id') || this.attr('class')}" was not initialized with bindForm.`);
    };
})(jQuery);
