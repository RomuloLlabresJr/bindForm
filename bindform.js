/**
Copyright (c) 2004 - Romulo P. Llabres Jr

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
**/

(function ($) {
    $.fn.bindForm = function (bindingObject, options = {}) {
        const $form = this;

        if ($form.data('bindFormInitialized')) {
            console.warn(`Form "${$form.attr('id') || $form.attr('class')}" is already bound. Destroy it before reinitializing.`);
            return;
        }

        $form.data('bindFormInitialized', true);

        bindingObject = bindingObject && typeof bindingObject === "object" ? bindingObject : {};

        const defaultOptions = {
            debounceTime: 300,
            validateOnChange: false,
            validators: {},
            readOnly: false,
            defaultValues: {},
            hooks: {
                onFieldChange: null,
                onFormUpdate: null,
                onObjectUpdate: null,
                onValidationFail: null,
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

        const getNestedValue = (obj, path) => {
            return path.split(".").reduce((current, key) => current?.[key], obj);
        };

        const setNestedValue = (obj, path, value) => {
            const keys = path.split(".");
            const lastKey = keys.pop();
            const target = keys.reduce((current, key) => current[key] = current[key] || {}, obj);
            target[lastKey] = value;
        };

        let $fields = $form.find("[name]");
        const updateForm = () => {
            $fields.each(function () {
                const $field = $(this);
                const name = $field.attr("name");
                const value = getNestedValue(bindingObject, name) ?? settings.defaultValues[name];

                if ($field.is(":checkbox")) {
                    $field.prop("checked", Boolean(value));
                } else {
                    $field.val(value || '');
                }
            });
        };

        const recordHistory = () => {
           let history = JSON.parse(localStorage.getItem('bindFormHistory') || '[]');
            history.push({
                state: JSON.stringify(bindingObject),
                timestamp: new Date().toISOString(),
            });
            localStorage.setItem('bindFormHistory', JSON.stringify(history));
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
            const name = $field.attr("name");

            let value;
            const isCheckbox = $field.is(":checkbox");
            if (isCheckbox) {
                value = $field.prop("checked");
            } else {
                value = $field.val();
            }

            if (name && (!settings.validateOnChange || validateField(name, value))) {
                updateObject(name, value, isCheckbox);
                settings.hooks.onFieldChange?.(name, value);
            }
        }, settings.debounceTime);

        $fields.on("input change", handleInputChange);

        if (!settings.oneWay) {
            const proxy = new Proxy(bindingObject, {
                set(target, prop, value) {
                    if (target[prop] !== value) {
                        recordHistory();
                        setNestedValue(target, prop, value);
                        const $field = $fields.filter(`[name="${prop}"]`);
                        if ($field.is(":checkbox")) {
                            $field.prop("checked", Boolean(value));
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

        const throttledMutationHandler = debounce(() => {
            $fields = $form.find("[name]");
            $fields.off("input change").on("input change", handleInputChange);
        }, 200);

        const observer = new MutationObserver((mutations) => {
            if (mutations.some(mutation => Array.from(mutation.addedNodes).some(node => node.matches?.("[name]")))) {
                throttledMutationHandler();
            }
        });
        observer.observe($form[0], { childList: true, subtree: true });

        if (settings.readOnly) {
            $fields.prop("disabled", true);
        }

        $form.data('bindFormDestroy', () => {
            $fields.off("input change");
            observer.disconnect();
            $form.removeData('bindFormInitialized').removeData('bindFormDestroy');
        });

        $form.data('restoreHistory', (timestamp) => {
            let history = JSON.parse(localStorage.getItem('bindFormHistory') || '[]');
            const record = history.find(h => h.timestamp === timestamp);
            if (record) {
                Object.assign(bindingObject, JSON.parse(record.state));
                updateForm();
            } else {
                console.warn("No history found for the given timestamp.");
            }
        });

        $form.data('getHistory', () => {
            let history = JSON.parse(localStorage.getItem('bindFormHistory') || '[]');
            return history.map(h => h.timestamp);
        });

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
