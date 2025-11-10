#jQuery bindForm Plugin

#Overview

    The bindForm plugin allows you to bind a form to an object, enabling seamless synchronization 
    between the form fields and the object’s properties. 
    It includes features like validation, change handling, read-only modes, history tracking, 
    and support for nested object paths.

#Features
    
    Two-Way Data Binding: Automatically sync form fields with an object.
    
    Validation: Integrate custom validators for specific fields.
    
    Debouncing: Control the frequency of updates to avoid unnecessary processing.
    
    History Tracking: Maintain a history of object states for restoration.
    
    Dynamic Updates: Automatically handle dynamic form elements added or removed.
    
    Read-Only Mode: Disable all form fields with a single configuration.

#Installation

    Include the jQuery library and the bindForm plugin in your project:

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="path/to/bindform.js"></script>

#Usage

    Initialization
    
    To initialize the plugin, call the bindForm method on a jQuery-selected form element and pass an object to bind:
    
    const myObject = {
        firstName: "John",
        lastName: "Doe",
        isSubscribed: true,
        preferences: {
            theme: "dark",
            notifications: true,
        },
    };
    
    $("#myForm").bindForm(myObject, {
        validateOnChange: true,
        debounceTime: 200,
        validators: {
            firstName: (value) => value.trim() !== "",
        },
        hooks: {
            onFieldChange: (name, value) => {
                console.log(`Field changed: ${name} = ${value}`);
            },
            onValidationFail: (name, value) => {
                console.error(`Validation failed for ${name}: ${value}`);
            },
        },
    });
    
    #HTML Example
    
    <form id="myForm">
        <input type="text" name="firstName" placeholder="First Name">
        <input type="text" name="lastName" placeholder="Last Name">
        <input type="checkbox" name="isSubscribed"> Subscribe to Newsletter
        <select name="preferences.theme">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    </form>

#Options
    
    Default Options
    
      const defaultOptions = {
            debounceTime: 1000,
            validateOnChange: false,
            allowUpdateOnFailed: true,
            validators: {},
            readOnly: false,
            defaultValues: {},
            showHistory: true,
            enableMutationObserver: true,
            encrypt: true,
            historyLimit: 10,
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

#Example of Passing Options

    $("#myForm").bindForm(myObject, {
        debounceTime: 200,
        validateOnChange: true,
        readOnly: true,
        hooks: {
            onFormUpdate: (prop, value) => {
                console.log(`Form updated: ${prop} = ${value}`);
            },
        },
    });

#Methods

    unbindForm()
    
    Unbinds the form and removes all event listeners and data attributes.
    
    $("#myForm").unbindForm();
    
    getHistory()
    
    Retrieves the timestamps of all saved history states.
    
    const history = $("#myForm").data('getHistory')();
    console.log(history);
    
    restoreHistory(timestamp)
    
    Restores the object state to a specific point in history.
    
    $("#myForm").data('restoreHistory')(timestamp);

#Sample Application

    HTML

    <form id="userForm">
        <input type="text" name="username" placeholder="Username">
        <input type="email" name="email" placeholder="Email">
        <input type="checkbox" name="acceptTerms"> Accept Terms
    </form>
    
    JavaScript
    
    const user = {
        username: "JaneDoe",
        email: "jane.doe@example.com",
        acceptTerms: false,
    };
    
    $("#userForm").bindForm(user, {
        debounceTime: 150,
        validators: {
            username: (value) => value.length >= 3,
            email: (value) => /.+@.+\..+/.test(value),
        },
        hooks: {
            onValidationFail: (name, value) => {
                alert(`${name} is invalid: ${value}`);
            },
            onFieldChange: (name, value) => {
                console.log(`Updated ${name} to ${value}`);
            },
        },
    });

    // using object design will update the object properties and the form;
    // sample 2 of using Object.assign;

     Object.assign(user, {
          firstName: "from object assign",
          lastName: "Smith",
          isSubscribed: false,
          preferences: {
            theme: "light",
            notifications: true,
          },
        });


        // sample 3 adding time out to update later; 
        // to simulate changes after eg. requesting new data via ajax.
        
        setTimeout(() => {

            Object.assign(user, {
              firstName: "another object assigned call",
              lastName: "Smith",
              isSubscribed: false,
              preferences: {
                theme: "light",
                notifications: false,
              },
            });
      }, 3000);


        /// another sample using form method importState;
        
        const newState = {
          firstName: "from importState",
          lastName: "Doex",
          isSubscribed: false,
          preferences: {
            theme: "dark",
            notifications: true,
          },
        };

        $("#myForm").data("importState")(newState);

    

#Notes

    Checkbox fields automatically handle true/false values.
    
    Nested object paths are supported using dot notation (e.g., preferences.theme).
    
    Make sure to destroy the binding using unbindForm before reinitializing a form.

#License

    MIT License
