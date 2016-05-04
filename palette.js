/*
 * Palette.js - Insert Elevator Pitch Here.
 *
 * Copyright (c) 2011 - 2016, Juerg Lehni
 * http://scratchdisk.com/
 *
 * Distributed under the MIT license. See LICENSE file for details.
 *
 * All rights reserved.
 */

// TODO: Sort out UMD & co:
var Palette = function() {

// From straps.js, inlined here:
var define = Object.defineProperty;
var describe = Object.getOwnPropertyDescriptor;
var forEach = [].forEach;

function forIn(iter, bind) {
    for (var i in this)
        if (this.hasOwnProperty(i))
            iter.call(bind, this[i], i, this);
}

function each(obj, iter, bind) {
    if (obj)
        ('length' in obj && typeof obj.length === 'number'
            ? forEach
            : forIn).call(obj, iter, bind = bind || obj);
    return bind;
}

function set(obj, props, exclude) {
    for (var key in props)
        if (props.hasOwnProperty(key) && !(exclude && exclude[key])) {
            obj[key] = props[key];
    }
    return obj;
}

function merge() {
    // Use Object.defineProperty so we can merge getters / setters too.
    var res = {};
    each(arguments, function(obj) {
        for (key in obj) {
            define(res, key, describe(obj, key));
        }
    })
    return res;
}

function pick(a, b) {
    return a === undefined ? b : a;
}

function isPlainObject(obj) {
    return obj && obj.constructor === Object;
}

 /**
 * @name Element
 * @namespace
 * @private
 */
var Element = new function() {
    // We use a mix of Bootstrap.js legacy and Bonzo.js magic, ported over and
    // further simplified to a subset actually required by Palette.js
    var special = /^(checked|value|selected|disabled)$/i;
    var translated = { text: 'textContent', html: 'innerHTML' };

    function create(nodes, parent) {
        var res = [];
        for (var i =  0, l = nodes && nodes.length; i < l;) {
            var el = nodes[i++];
            if (typeof el === 'string') {
                el = document.createElement(el);
            } else if (!el || !el.nodeType) {
                continue;
            }
            // Do we have attributes?
            if (isPlainObject(nodes[i]))
                Element.set(el, nodes[i++]);
            // Do we have children?
            if (Array.isArray(nodes[i]))
                create(nodes[i++], el);
            // Are we adding to a parent?
            if (parent)
                parent.appendChild(el);
            res.push(el);
        }
        return res;
    }

    return /** @lends Element */{
        create: function(nodes, parent) {
            var isArray = Array.isArray(nodes);
            var res = create(isArray ? nodes : arguments,
                        isArray ? parent : null);
            return res.length === 1 ? res[0] : res;
        },

        find: function(selector, root) {
            return (root || document).querySelector(selector);
        },

        get: function(el, key) {
            return el
                ? special.test(key)
                    ? key === 'value' || typeof el[key] !== 'string'
                        ? el[key]
                        : true
                    : key in translated
                        ? el[translated[key]]
                        : el.getAttribute(key)
                : null;
        },

        set: function(el, key, value) {
            if (typeof key !== 'string') {
                for (var name in key)
                    if (key.hasOwnProperty(name))
                        Element.set(el, name, key[name]);
            } else if (!el || value == null) {
                return el;
            } else if (special.test(key)) {
                el[key] = value;
            } else if (key in translated) {
                el[translated[key]] = value;
            } else if (key === 'events') {
                for (var type in value)
                    el.addEventListener(type, value[type], false);
            } else {
                el.setAttribute(key, value);
            }
            return el;
        },

        hasClass: function(el, cls) {
            return el && new RegExp('\\s*' + cls + '\\s*').test(el.className);
        },

        addClass: function(el, cls) {
            if (el && !Element.hasClass(el, cls)) {
                el.className = (el.className + ' ' + cls).trim();
            }
        },

        removeClass: function(el, cls) {
            if (el) {
                el.className = el.className.replace(
                    new RegExp('\\s*' + cls + '\\s*', 'g'), ' ').trim();
            }
        },

        toggleClass: function(el, cls, state) {
            Element[(state === undefined ? !Element.hasClass(el, cls)
                    : state) ? 'addClass' : 'removeClass'](el, cls);
        },

        remove: function(el) {
            if (el.parentNode)
                el.parentNode.removeChild(el);
        },

        addChild: function(el, child) {
            return create(child, el)[0];
        },

        addChildren: function(el, children) {
            // We can use the create() function for this too!
            return create(children, el);
        },

        removeChildren: function(el) {
            while (el.firstChild)
                el.removeChild(el.firstChild);
        },

        insertBefore: function(ref, el) {
            return ref.parentNode.insertBefore(create(el)[0], ref);
        }
    };
};

/**
 * @name Emitter
 * @private
 */
function Emitter() {
    // Returns a mixin object that contains three Emitter methods #on(), #off()
    // and #emit(), as well as getters & setters defined for all event
    // properties listed in the arguments, in a way that #onClick automatically
    // delegates to #on('click').
    return each(arguments, function(key) {
        var type = key.substring(2).toLowerCase();
        var name = '_' + key; 
        define(this, key, {
            enumerable: true,
            configurable: true,
            get: function() {
                return this[name];
            },
            set: function(func) {
                // Detach the previous event, if there was one.
                var prev = this[name];
                if (prev)
                    this.off(type, prev);
                if (func)
                    this.on(type, func);
                this[name] = func;
            }
        });
    }, {
        on: function(type, func) {
            var handlers = this._callbacks = this._callbacks || {};
            handlers = handlers[type] = handlers[type] || [];
            if (handlers.indexOf(func) === -1) {
                handlers.push(func);
            }
        },

        off: function(type, func) {
            var handlers = this._callbacks && this._callbacks[type];
            if (handlers) {
                // See if this is the last handler that we're detaching (or if
                // we are detaching all handlers).
                var index;
                if (!func || (index = handlers.indexOf(func)) !== -1
                        && handlers.length === 1) {
                    delete this._callbacks[type];
                } else if (index !== -1) {
                    handlers.splice(index, 1);
                }
            }
        },

        emit: function(type) {
            // Returns true if emitted, false otherwise
            var handlers = this._callbacks && this._callbacks[type];
            if (!handlers)
                return false;
            var args = [].slice.call(arguments, 1);
            for (var i = 0, l = handlers.length; i < l; i++) {
                if (handlers[i].apply(this, args) === false)
                    break;
            }
            return true;
        }
    });
}

/**
 * @name Palette
 * @class
 */
function Palette(props) {
    this._id = Palette._id = (Palette._id || 0) + 1;
    // Support legacy constructor(title, components, values)
    if (!isPlainObject(props)) {
        var args = arguments;
        props = { title: args[0], components: args[1], values: args[2] };
    }
    var components = this._components = props.components;
    var title = props.title;
    var name = this._name = props.name || (title
            // Hyphenate with '-' and replace non-word characters with '_'.
            ? title.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/\W/g, '_')
                .toLowerCase()
            : 'palette-' + this._id);
    this._values = props.values || {};
    // Create one root component that handles the layout and contains all
    // the components.
    var root = this._root = new Component(this, null, 'root', components,
            this._values);
    // Write the created components back into the passed components object,
    // so they are exposed and can easily be accessed from the outside.
    set(components, root._components);
    var parent = props.parent
            || Element.find('.palettejs-root')
            || Element.addChild(Element.find('body'),
                ['div', { class: 'palettejs-root' }]);
    this._element = Element.addChild(parent, ['div', {
                class: 'palettejs-palette' + root._classes,
                id: 'palettejs-palette-' + name
            }, [root._table]]);
    set(this, props, { components: true, values: true, parent: true });
    Palette.instances.push(this);
    Palette.instances[name] = this;
}

Palette.prototype = merge(Emitter('onChange'), /** @lends Palette# */{
    // DOCS: Palette#initialize(props)
    // DOCS: Palette#initialize(title, components, values)
    // DOCS: Palette#components
    // DOCS: Palette#values
    // DOCS: Palette#remove()

    get name() {
        return this._name;
    },

    get title() {
        return this._root.title;
    },

    set title(title) {
        this._root.title = title;
    },

    get element() {
        return this._element;
    },

    get components() {
        return this._components;
    },

    get values() {
        return this._values;
    },

    get enabled() {
        return this._root.enabled;
    },

    set enabled(enabled) {
        this._root._setEnabled(enabled, true);
    },

    /**
     * Resets the values of the components to their
     * {@link Component#defaultValue}.
     */
    reset: function() {
        this._root.reset();
    },

    remove: function() {
        Element.remove(this._element);
        var instances = Palette.instances;
        var index = instances.indexOf(this);
        var remove = index !== -1;
        if (remove) {
            instances.splice(index, 1);
            delete instances[this._id];
        }
        return remove;
    },

    toString: function() {
        return 'Palette ' + this._name || '@' + this._id;
    }
});

Palette.instances = [];

Palette.get = function(nameOrElement) {
    if (typeof nameOrElement === 'object') {
        // Support child elements by walking up the parents of the
        // element until the palette element is found.
        while (nameOrElement && !Element.hasClass(nameOrElement,
                'palettejs-palette'))
            nameOrElement = nameOrElement.parentNode;
        nameOrElement = (Element.get(nameOrElement, 'id')
                .match(/^palettejs-palette-(.*)$/) || [])[1];
    }
    return Palette.instances[nameOrElement];
};

// Component meta-information, by type.
// This is stored in #_meta on the components.
Palette.components = {
    'boolean': {
        type: 'checkbox',
        value: 'checked'
    },

    string: {
        tag: function(props) {
            // Use a textarea for multiline items (when #rows is defined).
            return props.rows === undefined ? 'input' : 'textarea';
        },
        type: 'text'
    },

    number: {
        type: 'number',
        number: true
    },

    button: {
        type: 'button',
        tag: 'button',
        value: 'text'
    },

    text: {
        tag: 'span',
        value: 'text'
    },

    color: {
        type: 'color'
    },

    slider: {
        type: 'range',
        number: true
    },

    ruler: {
        tag: 'hr'
    },

    progress: {
        tag: 'progress'
    },

    html: {
        tag: 'div',
        value: 'html'
    },

    list: {
        tag: 'select',

        setOptions: function() {
            Element.removeChildren(this._element);
            Element.addChildren(this._element,
                each(this._options, function(option) {
                    this.push('option', { value: option, text: option });
                }, []));
        }
    }
}

/**
 * @name Component
 * @class
 */
function Component(palette, parent, name, props, values, row) {
    if (!name)
        name = 'component-' + this._id;
    var value = pick(values[name], props.value);
    this._id = Component._id = (Component._id || 0) + 1;
    this._palette = palette;
    this._parent = parent;
    this._name = name;
    // The row within which this component is contained. This can be a shared
    // row, e.g. when the parent component has a columns layout.
    this._row = row;
    var type = this._type = props.type in Palette.components
            ? props.type
            : Array.isArray(props.options)
                ? 'list'
                : typeof props.onClick === 'function'
                    ? 'button'
                    : value !== undefined
                        ? typeof value
                        : undefined;
    var meta = this._meta = Palette.components[type] || { type: type };
    var element;
    var classes;
    if (row) {
        this._labelCell = Element.addChild(row, ['td', {
            class: 'palettejs-label',
            id: 'palettejs-label-' + name
        }]);
        // We just added one cell to the row:
        if (parent)
            parent._numCells++;
    }
    if (!type) {
        // No type defined, so we're dealing with a layout component that
        // contains nested child components. See if they are to be aligned as
        // columns or rows, and lay things out accordingly.
        // There are three possible types: 'rows', 'columns', 'horizontal'.
        // With 'rows' and 'columns' you make the child components a part of the
        // same parent table, so they are laid out in a grid, and their sizes
        // affect each other's positioning.
        // 'horizontal' is the same as 'columns' but the components get added to
        // their own separate table, thus only a s whole affecting the parent
        // table.
        var layout = props.layout || 'rows';
        var is = {};
        is[layout]= true;
        // On the root element, we need to create the table and row even if it's
        // a columns layout.
        var table = this._table = (is.horizontal || !(is.columns && row))
                ? Element.create('table', { class: 'palettejs-pane' },
                    ['tbody'])
                : null;
        if (is.horizontal)
            is.columns = true;
        var tbody = this._tbody = table && table.firstChild;
        var components = this._components = {};
        // Only use current row if no new table is inserted
        var currentRow = !table && row;
        var numCells = 0;
        element = table;
        classes = ' palettejs-layout palettejs-layout-' + layout;
        this._numCells = 0;
        for (var key in props) {
            var component = props[key];
            if (isPlainObject(component)) {
                // Create the rows for vertical elements, as well as columns
                // root elements.
                if (table && !(is.columns && currentRow)) {
                    currentRow = Element.addChild(tbody, ['tr', {
                        class: 'palettejs-row',
                        id: 'palettejs-row-' + key
                    }]);
                    // Set _row for the columns root element.
                    if (is.columns)
                        this._row = currentRow;
                }
                component = components[key] = new Component(
                        palette, this, key, component, values, currentRow);
                // Also expose nested components through Palette#components, but
                // only if there isn't already another component with the same
                // name defined already.
                if (!(key in palette._components))
                    palette._components[key] = component;
                // Keep track of the maximum amount of cells per row, so we can
                // adjust colspan after.
                numCells = Math.max(numCells, this._numCells);
                // Do not reset cell counter if all components go to the
                // same parent row.
                if (!is.columns)
                    this._numCells = 0;
                // Remove the entry now from the object that was provided to
                // create the component since the leftovers will be injected
                // into the created component through #_set() below.
                delete props[key];
            }
        }
        this._numCells = numCells;
        // If aligning things horizontally, we need to tell the parent how
        // many cells there are all together.
        if (is.columns && parent)
            parent._numCells = numCells;
        each(components, function(component, key) {
            // NOTE: Components with columns layout won't have their _cell set.
            if (numCells > 2 && component._cell && !is.columns)
                Element.set(component._cell, 'colspan', numCells);
            // Replace each entry in values with getters/setters so we can
            // directly link the value to the component and observe change.
            if (key in values) {
                delete values[key];
                define(values, key, {
                    enumerable: true,
                    configurable: true,
                    get: function() {
                        return component.value;
                    },
                    set: function(val) {
                        component.value = val;
                    }
                });
            }
        });
        // Add child components directly to this component, so we can access
        // them through the same path as in the components object literal that
        // was passed.
        set(this, components);
    } else {
        var that = this;
        var tag = typeof meta.tag === 'function'
                ?  meta.tag.call(this, props)
                :  meta.tag || 'input';
        this._labelId = /^(input|textarea)$/.test(tag)
                ? 'palettejs-input-' + name : null;
        element = this._element = Element.create(tag, {
            id: this._labelId,
            type: meta.type,
            events: {
                change: function() {
                    that.value = Element.get(this, meta.value || 'value');
                },
                click: function() {
                    that.emit('click');
                }
            }
        });
        classes = ' palettejs-type-' + type;
    }
    if (element) {
        this._cell = Element.addChild(row, ['td', {
                class: 'palettejs-component' + classes,
                id: 'palettejs-component-' + name
            }, [element]
        ]);
        if (parent)
            parent._numCells++;
    }
    this._classes = classes;
    // Attach default 'change' even that delegates to the palette.
    this.on('change', function(value) {
        if (this._emit)
            palette.emit('change', this, this._name, value);
    });
    // Now that everything is set up, copy over values fro, props.
    // NOTE: This triggers setters, which is why we set _emit = false, and why
    // we can only call this after everything else is set up (e.g. set label() 
    // requires this._labelCell).
    this._emit = false;
    // Exclude name because it's already set, and value since we want to set
    // it after range.
    set(this, props, { name: true, value: true });
    this._defaultValue = this.value = value;
    if (meta.create)
        meta.create.call(this);
    // Start firing change events after we have initialized.
    this._emit = true;
}

Component.prototype = merge(Emitter('onChange', 'onClick'),
each(['type', 'name', 'title', 'palette', 'parent', 'element', 'label',
        'suffix', 'options', 'visible', 'enabled'],
    // Inject getters for all properties that simply redirect to the 'hidden'
    // property that is prefixed with '_'.
    function(key) {
        var name = '_' + key;
        define(this, key, {
            enumerable: true,
            configurable: true,
            get: function() {
                return this[name];
            }
        });
    },
/** @lends Component# */{
    // DOCS: All!

    // Default values for internals
    _visible: true,
    _enabled: true,

    set title(title) {
        this._title = title;
        if (this._tbody) {
            var node = this._titleNode;
            if (!node && title) {
                // Create a caption tag, and nest the title in a span inside,
                // so we can offer some more flexibility with CSS on it.
                node = this._titleNode = Element.insertBefore(this._tbody, [
                        'caption', [ 'span' ],
                    ]).firstChild;
            } else if (node && !title) {
                Element.remove(node);
            }
            Element.set(node, 'text', title);
        }
    },

    get value() {
        var value = this._value,
            getValue = this._meta.getValue;
        return getValue ? getValue.call(this, value) : value;
    },

    set value(value) {
        if (this._components)
            return;
        var meta = this._meta;
        var key = meta.value || 'value';
        var setValue = meta.setValue;
        if (setValue)
            value = setValue.call(this, value);
        // If setValue doesn't return a value, then we assume it took care of
        // the setting by itself.
        if (value !== undefined) {
            Element.set(this._element, key, value);
            // Read back and convert from input again to make sure we're in sync
            value = Element.get(this._element, key);
        }
        if (meta.number)
            value = parseFloat(value, 10);
        if (this._value !== value) {
            this._value = value;
            if (this._emit)
                this.emit('change', this.value);
        }
    },

    // Setup #text as an alias to #value, for better semantics when creating
    // buttons.
    get text() {
        return this.value;
    },

    set text(text) {
        this.value = text;
    },

    _setLabel: function(label, nodeName, parent) {
        if (parent) {
            this[nodeName] = Element.set(this[nodeName]
                    || Element.addChild(parent,
                        ['label', { 'for': this._labelId }]),
                    'text', label);
        }
    },

    set label(label) {
        this._label = label;
        this._setLabel(label, '_labelNode', this._labelCell);
    },

    set suffix(suffix) {
        this._suffix = suffix;
        this._setLabel(suffix, '_suffixNode', this._cell);
    },

    set options(options) {
        this._options = options;
        var setOptions = this._meta.setOptions;
        if (setOptions)
            setOptions.call(this);
    },

    set visible(visible) {
        // NOTE: Only set the visibility of the whole row if this is a row item,
        // in which case this._cell is not defined.
        Element.toggleClass(this._cell || this._row, 'hidden', !visible);
        Element.toggleClass(this._labelCell, 'hidden', !visible);
        var setVisible = this._meta.setVisible;
        if (setVisible)
            setVisible.call(this, visible);
        this._visible = !!visible;
    },

    _setEnabled: function(enabled, _fromParent) {
        if (!enabled ^ this._enabled) 
            return;
        if (_fromParent) {
            // When called from the parent component, we have to remember the
            // component's previous enabled state when disabling the palette,
            // so we can restore it when enabling the palette again.
            var prev = pick(this._previousEnabled, this._enabled);
            this._previousEnabled = enabled ? undefined : prev; // clear
            enabled = enabled && prev;
        }
        Element.toggleClass(this._cell || this._row, 'disabled', !enabled);
        if (this._components) {
            for (var i in this._components)
                this._components[i]._setEnabled(enabled, true);
        } else {
            Element.set(this._element, 'disabled', !enabled);
            var setEnabled = this._meta.setEnabled;
            if (setEnabled)
                setEnabled.call(this, enabled);
        }
        this._enabled = !!enabled;
    },

    set enabled(enabled) {
        this._setEnabled(enabled);
    },

    get range() {
        return [this._min, this._max];
    },

    set range(range) {
        this.min = range ? range[0] : null;
        this.max = range ? range[1] : null;
    },

    reset: function() {
        if (this._components) {
            for (var i in this._components)
                this._components[i].reset();
        } else {
            this.value = this._defaultValue;
        }
    },

    toString: function() {
        return 'Component ' + this._name || '@' + this._id;
    }
}),
each(['min', 'max', 'step', 'rows', 'readonly', 'placeholder'],
    // Inject getters and setters for all properties that simply redirect to the
    // underlying HTML element.
    function(key) {
        var name = '_' + key;
        define(this, key, {
            enumerable: true,
            configurable: true,
            get: function() {
                return this[name];
            },
            set: function(value) {
                this[name] = value;
                Element.set(this._element, key, value);
            }
        });
    }, {})
);

return Palette;
}();
