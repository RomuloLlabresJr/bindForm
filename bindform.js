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
            debounceTime: 300,
            validateOnChange: false,
            validators: {},
            readOnly: false,
            defaultValues: {},
            enableMutationObserver : true,
            hooks: {
                onFieldChange: null,
                onFormUpdate: null,
                onObjectUpdate: null,
                onValidationFail: null,
                onFormSubmit: null,
                handleFormSubmission : async () => true,
                afterSubmit: null, // New hook for after submit
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

        const setNestedValue = (obj, path, value) => {
            const keys = path.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((current, key) => (current[key] = current[key] || {}), obj);
            target[lastKey] = value;
        };

        let $fields = $form.find('[name]');

        const updateForm = () => {
            $fields.each(function () {
                const $field = $(this);
                const name = $field.attr('name');
                const value = getNestedValue(bindingObject, name) ?? settings.defaultValues[name];
                const fieldType = $field.prop('type');
        
                switch (fieldType) {
                    case 'checkbox':
                        $field.prop('checked', Boolean(value));
                        break;
        
                    case 'radio':
                        $field.prop('checked', $field.val() === String(value));
                        break;
        
                    case 'select-one':
                    case 'select-multiple':
                        $field.val(value || '').trigger('change'); // Trigger change to update dependent UI if needed
                        break;
                   default:
                        $field.val(value || '');

                }
            });
        };
        

        const recordHistory = () => {
            let history = JSON.parse(localStorage.getItem(localStorageFormKey) || '[]');
            history.push({
                state: JSON.stringify(bindingObject),
                timestamp: new Date().toISOString(),
            });
            localStorage.setItem(localStorageFormKey, JSON.stringify(history));
        };

        const updateObject = (name, value, isCheckbox = false) => {
            recordHistory();
            const finalValue = isCheckbox ? Boolean(value) : value;
            setNestedValue(bindingObject, name, finalValue);
            settings.hooks.onObjectUpdate?.(bindingObject);
        };

        const validateField = (name, value) => {
            const validator = settings.validators[name];
            if (validator && !validator(value)) {
                settings.hooks.onValidationFail?.(name, value);
                return false;
            }
            return true;
        };

        const handleInputChange = debounce((event) => {
            const $field = $(event.target);
            const name = $field.attr('name');
        
            if (!name) return;
        
            const value = $field.is(':checkbox') ? $field.prop('checked') : $field.val();
        
            if (!settings.validateOnChange || validateField(name, value)) {
                updateObject(name, value, $field.is(':checkbox'));
                settings.hooks.onFieldChange?.(name, value);
            }
        }, settings.debounceTime);
        

        $fields.on('input change', handleInputChange);

        let proxy;
        if (!settings.oneWay) {
            proxy = new Proxy(bindingObject, {
                set(target, prop, value) {
                    if (target[prop] !== value) {
                        recordHistory();
                        setNestedValue(target, prop, value);
                        const $field = $fields.filter(`[name="${prop}"]`);
                        if ($field.is(':checkbox')) {
                            $field.prop('checked', Boolean(value));
                        } else {
                            $field.val(value);
                        }
                        settings.hooks.onFormUpdate?.(prop, value);
                    }
                    return true;
                },
            });
            bindingObject = proxy;
        }

        updateForm();


        if(settings.enableMutationObserver) {
            const throttledMutationHandler = debounce(() => {
                $fields = $form.find('[name]');
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


        const validateForm = ()=>{
            $form.find('input, select, textarea').each(function () {
                const $field = $(this);
                const name = $field.attr('name');
                const value = $field.val();
                let result =  validateField(name, value);
                if (!result) {
                    return false;
                }
            });
            return true;
        }

        // Add submit handler
        $form.on('submit', async function (e) {
            e.preventDefault();

            if(!validateForm()){
                return;
            }
            
            if (settings.hooks.onFormSubmit) {
                const shouldSubmit = await settings.hooks.onFormSubmit(bindingObject, e);
                if (shouldSubmit === false) {
                    return;
                }
            }
            const result = await settings.hooks.handleFormSubmission(bindingObject, e);
            
            // Trigger afterSubmit
            settings.hooks.afterSubmit?.(result, bindingObject, e);
        });

        // Add importState and exportState
        $form.data('importState', (newState) => {
            Object.assign(bindingObject, newState);
            updateForm();
        });

        $form.data('exportState', () => {
            return { ...bindingObject };
        });

        $form.data('bindFormDestroy', () => {
            $fields.off('input change');
            $form.off('submit');
            observer.disconnect();
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
        if (destroyFn) {
            destroyFn();
        } else {
            console.warn(`Form "${this.attr('id') || this.attr('class')}" was not initialized with bindForm.`);
        }
    };
})(jQuery);
