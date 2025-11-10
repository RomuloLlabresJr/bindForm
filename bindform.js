/***
MIT License

Copyright (c) 2024 Romulo Llabres Jr

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



        const ObjectCompressorHelper = (function () {
            let pakoInstance = null;

            // Dynamically load pako library asynchronously
            async function loadPako() {
                if (pakoInstance) return pakoInstance;
                if (typeof window.pako !== 'undefined') {
                    pakoInstance = window.pako;
                    return pakoInstance;
                }

                const script = document.createElement('script');
                script.src = "https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js";
                script.async = true;
                document.head.appendChild(script);

                await new Promise((resolve, reject) => {
                    script.onload = () => {
                        pakoInstance = window.pako;
                        resolve();
                    };
                    script.onerror = () => reject(new Error('Failed to load pako library.'));
                });

                return pakoInstance;
            }

            // Synchronous compressor API (assumes loadPako() was called before use)
           function compress(obj) {
                if (!pakoInstance) {
                    console.error('Pako not loaded. Call ObjectCompressorHelper.loadPako() first.');
                    return null;
                }

                try {
                    const json = JSON.stringify(obj);
                    const originalSize = new TextEncoder().encode(json).length;

                    const uint8 = new TextEncoder().encode(json);
                    const compressed = pakoInstance.deflate(uint8);
                    const base64 = btoa(String.fromCharCode(...compressed));

                    const compressedSize = compressed.length;
                    console.log(`Compression: original size = ${originalSize} bytes, compressed size = ${compressedSize} bytes, reduction = ${(100 * (originalSize - compressedSize) / originalSize).toFixed(2)}%`);

                    return base64;
                } catch (e) {
                    console.error('Compression error:', e);
                    return null;
                }
            }

            function decompress(base64) {
                if (!pakoInstance) {
                    console.error('Pako not loaded. Call ObjectCompressorHelper.loadPako() first.');
                    return null;
                }

                try {
                    const binary = atob(base64);
                    const compressed = Uint8Array.from(binary, c => c.charCodeAt(0));
                    const decompressed = pakoInstance.inflate(compressed);
                    const json = new TextDecoder().decode(decompressed);

                    console.log(`Decompression: compressed size = ${compressed.length} bytes, decompressed size = ${decompressed.length} bytes`);

                    return JSON.parse(json);
                } catch (e) {
                    console.error('Decompression error:', e);
                    return null;
                }
            }


            return { compress, decompress, loadPako };
        })();



    const CryptoHelper = (async (useEncryption) => {
        let isLoaded = false; // Tracks if CryptoJS is loaded

        if (!useEncryption) {
            return {
                encrypt: (secretKey, data) => data,
                decrypt: (secretKey, data) => data,
                generateSecretKey: () => '',
            }
        }
    
        // Function to load CryptoJS script
        const loadJS = () => {
            return new Promise((resolve, reject) => {
                if (isLoaded) {
                    console.log('CryptoJS already loaded.');
                    resolve();
                    return;
                }
    
                const scriptId = 'crypto-js-script';
                if (document.getElementById(scriptId)) {
                    console.log('CryptoJS already loaded.');
                    isLoaded = true;
                    resolve();
                    return;
                }
    
                // Dynamically load the script
                const script = document.createElement('script');
                script.id = scriptId;
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js';
    
                script.onload = () => {
                    console.log('CryptoJS loaded successfully.');
                    isLoaded = true;
                    resolve();
                };
    
                script.onerror = () => {
                    console.error('Failed to load CryptoJS.');
                    reject(new Error('Failed to load CryptoJS.'));
                };
    
                document.head.appendChild(script);
            });
        };
    
        // Wait for the CryptoJS to load
        await loadJS();

        let useCompression = true;
        if(useCompression == true) {
             await ObjectCompressorHelper.loadPako();
        };

       
    
        // Return the methods after ensuring CryptoJS is loaded
        return {
            encrypt: function (secretKey, data) {
                if(data == null) return null;
                if (!isLoaded) {
                    console.error('CryptoJS is not loaded yet.');
                    return;
                }
                
                const compressed = ObjectCompressorHelper.compress(data);

                return CryptoJS.AES.encrypt(JSON.stringify(compressed), secretKey).toString();
            },
    
             decrypt: function (secretKey, encrypted) {
                if (encrypted == null) return null;
                if (!isLoaded) {
                    console.error('CryptoJS is not loaded yet.');
                    return null;
                }

                try {
                    // AES decrypt -> yields JSON.stringify(compressedBase64)
                    const bytes = CryptoJS.AES.decrypt(encrypted, secretKey);
                    const decrypted = bytes.toString(CryptoJS.enc.Utf8); // should be a JSON string like: "\"base64...\""

                    if (!decrypted) {
                        console.warn('Decryption returned empty string.');
                        return null;
                    }

                    // Parse the JSON to recover the original compressed base64 string
                    let compressedBase64;
                    try {
                        compressedBase64 = JSON.parse(decrypted);
                    } catch (e) {
                        // If it wasn't JSON (unexpected), assume it's the raw base64
                        compressedBase64 = decrypted;
                    }

                    // Decompress synchronously
                    const obj = ObjectCompressorHelper.decompress(compressedBase64);
                    return obj;
                } catch (e) {
                    console.error('Error during decrypt/decompress:', e);
                    return null;
                }
            },
    
            generateSecretKey: async function (formId) {
                if (!isLoaded) {
                    console.error('CryptoJS is not loaded yet.');
                    return;
                }
                if (!formId) {
                    throw new Error('Form ID is required to generate a secret key.');
                }

                // Helper to get the local IP using WebRTC
                async function getLocalIP() {
                    return new Promise((resolve, reject) => {
                        const pc = new RTCPeerConnection({ iceServers: [] });
                        pc.createDataChannel('');
                        pc.createOffer()
                            .then(offer => pc.setLocalDescription(offer))
                            .catch(reject);

                        pc.onicecandidate = (event) => {
                            if (!event || !event.candidate) return;
                            const candidate = event.candidate.candidate;
                            const match = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
                            if (match) {
                                resolve(match[1]);
                                pc.close();
                            }
                        };

                        setTimeout(() => {
                            resolve('127.0.0.1'); // fallback if local IP not detected
                            pc.close();
                        }, 1000);
                    });
                }

                const localIP = await getLocalIP();
                const combined = formId + '|' + localIP;
                console.log(`Generating secure key using form ID "${formId}" and local IP "${localIP}"`);
                // Derive a strong key using SHA-256
                const hash = CryptoJS.SHA256(combined).toString(CryptoJS.enc.Hex);

                console.log(`Generated secure key for form "${formId}" with IP ${localIP}:`, hash);

                return hash;
            }
        };
    });
    
    $.fn.bindForm = function (bindingObject, options = {}) {
       return (async () => {

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
                encrypt: true,
             
                validationClass: 'is-invalid', // Default invalid class
                historySettings : {
                    $container : $(),
                    showHistory : true,
                    historyLimit: 100,
                },
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

            const getNestedValue = (() => {
                const cache = new Map();
                
                return (obj, path) => {
                    const cacheKey = JSON.stringify({ obj, path });
                    if (cache.has(cacheKey)) {
                        console.log('Value retrieved from cache');
                        return cache.get(cacheKey);
                    }
                
                    const value = path.split('.').reduce((current, key) => current?.[key], obj);
                    cache.set(cacheKey, value);
                    return value;
                };
            })();
              

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
            
           
                        
           const cryptoHelper =  await CryptoHelper(settings.encrypt);

            const _SecretKey = settings.encrypt ? await cryptoHelper.generateSecretKey(id) : id;

            const encrypt = (data) => {
                if (data == null) return null;

                return settings.encrypt
                    ? cryptoHelper.encrypt(_SecretKey, data)
                    : JSON.stringify(data);
            };

            const decrypt = (data) => {
                if (!data) return null;
                return settings.encrypt
                    ? cryptoHelper.decrypt(_SecretKey, data)
                    : JSON.parse(data);
            };
            // Updated recordHistory with encryption
            const recordHistory = (() => {
                const stateKey = `${localStorageFormKey}_state`; // Key to store lastRecordedState and lastRecordedTime.

                return () => {
                    const currentState = JSON.stringify(bindingObject);
                    const now = Date.now();

                    // Retrieve and decrypt state data from localStorage.
                    let stateData = decrypt(localStorage.getItem(stateKey) || '') || {};
                    let lastRecordedState = stateData.lastRecordedState || null;
                    let lastRecordedTime = stateData.lastRecordedTime || 0;

                    // Record only if the state has changed or a reasonable time has passed.
                    if (currentState !== lastRecordedState || now - lastRecordedTime > 500) {
                        let history = decrypt(localStorage.getItem(localStorageFormKey) || '') || [];

                        // Add the new history entry.
                        history.push({
                            state: currentState,
                            timestamp: new Date().toISOString(),
                        });

                        // Check and enforce the storage limit.
                        const historyLimit = settings.historyLimit; // Default limit to 10 if not set in settings.
                        if (history.length > historyLimit) {
                            history = history.slice(-historyLimit); // Keep only the last `historyLimit` entries.
                        }

                        // Save updated history to localStorage with encryption.
                        localStorage.setItem(localStorageFormKey, encrypt(history));

                        // Update and save last recorded state and time with encryption.
                        stateData = {
                            lastRecordedState: currentState,
                            lastRecordedTime: now,
                        };
                        localStorage.setItem(stateKey, encrypt(stateData));

                        showRecordHistory();
                    }
                };
            })();

            const showRecordHistory = () => {

                let { showHistory, $container } = settings.historySettings;


                $container = $container.length > 0 
                        ? $container 
                        : $form.find('#history_container');

                // If #history_container doesn't exist inside the form, create it
                if ($container.length === 0) {
                    $container = $('<div>', { id: 'history_container', class: 'history-container' });
                    $form.append($container);
                }

                if (showHistory) {
                    // Remove existing list if it exists
                    $container.empty();
            
                    // Create a new history list
                    const $historyList = $('<ul id="history_list">').appendTo($container);
            
                    // Retrieve and decrypt history
                    const history = decrypt(localStorage.getItem(localStorageFormKey) || '') || [];
            
                    // Populate the history list
                    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    
                    history.forEach((h, index) => {
                        // Format timestamp
                        const formattedDate = new Date(h.timestamp).toLocaleString(); // Human-readable format
            
                        $('<li>')
                            .text(`Revision ${index + 1} - ${formattedDate}`)
                            .css('cursor', 'pointer')
                            .on('click', () => $form.data('restoreHistory')(h.timestamp))
                            .appendTo($historyList);
                    });
                }
            };

            showRecordHistory();

            const updateObject = (name, value, isCheckbox = false) => {
                const finalValue = isCheckbox ? Boolean(value) : value;

                // Use `setNestedValue` to update the object only if the value differs.
                if (setNestedValue(bindingObject, name, finalValue)) {

                    // Trigger hooks only once per actual update.
                    if (settings.autoSave == 0) {
                        recordHistory();
                    }
                    settings.hooks.onObjectUpdate?.(bindingObject);
                }
            };

            const setNestedValue = (() => {
                const cache = new Map();
              
                return (obj, path, value) => {
                  if (!obj || typeof obj !== 'object' || typeof path !== 'string') {
                    throw new Error('Invalid arguments');
                  }
              
                  const cacheKey = JSON.stringify({ obj, path });
                  const cachedValue = cache.get(cacheKey);
              
                  // Check if the value is already cached and the same
                  if (cachedValue === value) {
                    console.log('value is already cached and the same');
                    return false;
                  }
              
                  const keys = path.split('.');
                  const lastKey = keys.pop();
              
                  const target = keys.reduce((current, key) => {
                    if (!current[key] || typeof current[key] !== 'object') {
                      current[key] = {};
                    }
                    return current[key];
                  }, obj);
              
                  // Only update the value if it's different
                  if (target[lastKey] !== value) {
                    target[lastKey] = value;
                    cache.set(cacheKey, value); // Update the cache
                    return true;
                  }
              
                  return false;
                };
              })();
              

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

            const recordHistoryDebounced = debounce(recordHistory, 300);

            // Keep a snapshot of previous state
            let prevState = { ...bindingObject };

            const proxy = new Proxy(bindingObject, {
                set(target, prop, value) {
                    if (target[prop] !== value) {
                        console.log('invoking proxy setting:', prop);

                        // Update proxy target
                        target[prop] = value;

                        // Locate corresponding field
                        const $field = $fields.filter(`[name="${prop}"]`);

                        // Update DOM field value
                        if ($field.is(':checkbox')) {
                            $field.prop('checked', Boolean(value));
                        } else {
                            $field.val(value);
                        }

                        // Prevent circular updates
                        updateObject(prop, value, $field.is(':checkbox'));
                        updateForm();

                        // Check if object has changed since last snapshot
                        const changed = JSON.stringify(prevState) !== JSON.stringify(target);

                        if (changed) {
                            recordHistoryDebounced(); // only fires once after all rapid changes
                            prevState = { ...target }; // update snapshot
                        }
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
                if (autoSaveInterval) clearInterval(autoSaveInterval);
                $form.removeData('bindFormInitialized').removeData('bindFormDestroy');
            });


            $form.data('restoreHistory', (timestamp) => {
                const history = decrypt(localStorage.getItem(localStorageFormKey) || '') || [];
                const record = history.find(h => h.timestamp === timestamp);
                if (record) {
                    Object.assign(bindingObject, JSON.parse(record.state));
                    updateForm();
                } else {
                    console.warn('No history found for the given timestamp.');
                }
            });

            $form.data('getHistory', () => {
                const history = decrypt(localStorage.getItem(localStorageFormKey) || '') || [];
                return history.map(h => h.timestamp);
            });

            $form.data('getProxy', () => bindingObject);

            return bindingObject;

        })();

    };

    $.fn.unbindForm = function () {
        const destroyFn = this.data('bindFormDestroy');
        if (destroyFn) destroyFn();
        else console.warn(`Form "${this.attr('id') || this.attr('class')}" was not initialized with bindForm.`);
    };
})(jQuery);

// # sourceMappingURL=bindform.js.map