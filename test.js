QUnit.module("bindForm Plugin", function (hooks) {
    let $form, bindingObject, defaultOptions;

    hooks.beforeEach(function () {
        $form = $('<form id="testForm"><input name="field1"><input name="field2" type="checkbox"></form>');
        bindingObject = { field1: "test value", field2: true };
        defaultOptions = {
            debounceTime: 300,
            validateOnChange: false,
            validators: {
                field1: (value) => value &&  value.length > 0,
            },
            validationClass: 'is-invalid',
            hooks: {
                onValidationFail: (name, value) => {
                    console.log(`Validation failed for ${name} with value ${value}`);
                },
                onFieldChange: (name, value) => {
                    console.log(`Field ${name} changed to ${value}`);
                },
                onObjectUpdate: (obj) => {
                    console.log("Object updated:", obj);
                },
                onFormUpdate: (prop, value) => {
                    console.log(`Form updated: ${prop} = ${value}`);
                },
                onFormSubmit: (obj, e) => {
                    console.log("Form submitted:", obj);
                },
                handleFormSubmission: async (obj, e) => true,
                afterSubmit: (result, obj, e) => {
                    console.log("After submit:", result, obj);
                },
                handleValidation: (field, isValid, validationClass) => {
                    console.log(field, isValid, validationClass)
                    if (isValid) {
                        field.removeClass(validationClass);
                    } else {
                        field.addClass(validationClass);
                    }
                },
            },
        };
    });

    hooks.afterEach(function () {
        $form.remove();
        bindingObject = null;
        defaultOptions = null;
    });

    QUnit.test("Initializes plugin correctly and binds form fields", function (assert) {
        $form.bindForm(bindingObject, defaultOptions);
        assert.ok($form.data("bindFormInitialized"), "bindForm initialized");
        assert.strictEqual(bindingObject.field1, "test value", "Field1 value is correctly bound");
        assert.strictEqual(bindingObject.field2, true, "Checkbox value is correctly bound");
    });

    QUnit.test("Handles field changes and updates bindingObject", function (assert) {
        const done = assert.async();

        $form.bindForm(bindingObject, defaultOptions);

        const $field = $form.find('[name="field1"]');
        $field.val("new value").trigger("input");

        setTimeout(() => {
            assert.strictEqual(bindingObject.field1, "new value", "Binding object updated on field change");
            done();
        }, defaultOptions.debounceTime + 50);
    });
});
