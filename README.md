#jQuery bindForm Plugin

#Overview

    The bindForm plugin allows you to bind a form to an object, enabling seamless synchronization between the form fields and the object’s properties. It includes features like validation, change handling, read-only modes, history tracking, and support for nested object paths.

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
        debounceTime: 300,             // Delay in ms for handling input changes
        validateOnChange: false,       // Perform validation on field change
        validators: {},                // Custom field validators
        readOnly: false,               // Set form fields to read-only mode
        defaultValues: {},             // Default values for fields
        hooks: {                       // Lifecycle hooks
            onFieldChange: null,
            onFormUpdate: null,
            onObjectUpdate: null,
            onValidationFail: null,
        },
        oneWay: false,                 // Disable two-way binding if true
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

#Notes

    Checkbox fields automatically handle true/false values.
    
    Nested object paths are supported using dot notation (e.g., preferences.theme).
    
    Make sure to destroy the binding using unbindForm before reinitializing a form.

#License

This plugin is open-source and licensed under the MIT License.
