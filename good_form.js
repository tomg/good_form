/** GoodForm 0.6
 *
 * http://github.com/cementhorses/good_form
 *
 * Copyright (c) 2008-* Stephen Celis. Released by Cement Horses under the MIT
 * License. Active Record validations and documentation liberally extracted and
 * modified.
 *
 * Rails developers will find a nice little bridge here:
 *
 * http://github.com/cementhorses/good_form_rails
 *
 *
 *** The gist:
 *
 * - Library-agnostic!
 * - Unit-tested!
 * - Ajax and client-side validations.
 *
 *
 *** Example
 *
 * A typical set of validations:
 *
 *   Validates.Presence("login", "email", "password", "password_confirmation");
 *   Validates.Length("login", { maximum: 100 });
 *   Validates.Format("email", { "with": /^([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})$/i, allowBlank: true });
 *   Validates.Length("email", { within: [6, 100] });
 *   Validates.Ajax("email", { "if": Validate.Local });
 *   Validates.Confirmation("password", { allowBlank: true });
 *   Validates.Length("password", { within: [6, 40] });
 *
 *
 *** Shared options
 *
 * All validations share the following options:
 *
 * - +allowBlank+ - Skip validation if attribute is blank (a string that only
 *   contains whitespace)
 * - +allowNull+ - Skip validation if attribute is null (or a zero-length
 *   string)
 * - <tt>"if"</tt> - Skip validation if condition fails
 * - +unless+ - Skip validation if condition passes
 *
 * All local validations additionally share the following options:
 *
 * - +message+ - A custom error message
 * - +onFail+ - A callback executed when the validation fails
 * - +onPass+ - A callback executed when the validation passes
 *
 *
 *** Extension
 *
 * NOTE: To customize the appearance of validations, see Validates.Base.Effect.
 *
 * The formula for a new Validates function is quite simple. An example:
 *
 *   Validates.Capitalized = function () {
 *     GoodForm.Validates.Base(arguments, {
 *       validate: function () {
 *         var value = this.getValue();
 *         if (value != value.toUpperCase())
 *           return v.message || "must be capitalized";
 *       }
 *     }
 *   }
 *
 * Now, we can validate a form element:
 *
 *   Validates.Capitalized("name");
 */
var GoodForm = {
  /*
   * References all local validations defined on a page, by name.
   *
   *   Validates.Acceptance("privacy_policy");
   *   GoodForm.local.privacy_policy; // => [GoodForm.Validation object]
   */
  local: {},

  /*
   * References all remote validations defined on a page, by name.
   */
  remote: {},

  /*
   * Stores the default error messages at various nodes. Add to or modify the
   * object for global changes.
   */
  defaultErrorMessages: {
    inclusion: "is not included in the list",
    exclusion: "is reserved",
    invalid: "is invalid",
    confirmation: "doesn't match",
    accepted: "must be accepted",
    empty: "can't be empty",
    blank: "can't be blank",
    tooLong: "is too long (maximum is %d characters)",
    tooShort: "is too short (minimum is %d characters)",
    wrongLength: "is the wrong length (should be %d characters)",
    taken: "has already been taken",
    notANumber: "is not a number",
    greaterThan: "must be greater than %d",
    greaterThanOrEqualTo: "must be greater than or equal to %d",
    equalTo: "must be equal to %d",
    lessThan: "must be less than %d",
    lessThanOrEqualTo: "must be less than or equal to %d",
    odd: "must be odd",
    even: "must be even"
  },

  /*
   * Specifies a default message to display for valid items.
   */
  validMessage: "",

  /*
   * GoodForm.validMessages nodes can be overridden for any form element
   * name.
   *
   *   Validate("login"); // => null
   *   GoodForm.validMessages["login"] = "That's a nice name!"
   *   Validate("login"); // => "That's a nice name!"
   */
  validMessages: {},

  /*
   * Specifies a path to handle Ajax validations (default: "/validate").
   */
  remotePath: "/validate",

  /*
   * Between the request and response of the Ajax cycle, the span that shows
   * the validation message is given the className "loading"; it can also be
   * given content by assigning a string to GoodForm.loadingMessage.
   */
  loadingMessage: "",

  /*
   * The Validation object. Will work given a custom validation() function
   * defined to return an error message or null.
   *
   *   var v = new GoodForm.Validation(["field"]);
   *   v.validate = function () { return "is always invalid" };
   *   Validate("field"); // => false
   *   GoodForm.Validate.response["field"]; // => ["is always invalid"];
   */
  Validation: function (arg, options) {
    this.elements = GoodForm.Helpers.getElements(arg)
    if (!this.elements) throw new Error("'" + arg + "' cannot be validated");
    if (this.elements.length == 1) this.element = this.elements[0];
    this.name = this.elements[0].name, this.form = this.elements[0].form;

    this.getValue = function () {
      if (this.element)
        return (this.element.checked || !this.element.type.match(/checkbox|radio/)) ? this.element.value : "";
      var values = [];
      for (var i = 0, len = this.elements.length; i < len; ++i) {
        var element = this.elements[i];
        if (element.checked || !element.type.match(/checkbox|radio/))
          values.push(element.value)
      }
      return values;
    }

    this.shouldValidate = function () {
      var value = this.getValue();
      switch (true) {
        case (this.allowBlank && (/^\s*$/).test(value)):
        case (this.allowNull && value == ""):
        case (this["if"] && !this["if"](this.name)):
        case (this.unless && this.unless(this.name)):
          return false;
        default:
          return true;
      }
    }

    this.register = function () {
      var type = this.remote ? "remote" : "local";
      if (!GoodForm[type][this.name]) GoodForm[type][this.name] = [];
      GoodForm[type][this.name].push(this);
    }

    // Apply options
    for (var name in options) this[name] = options[name];

    // Alias method chain
    this.validateWithoutChecking = this.validate;
    this.validate = function () {
      if (this.shouldValidate()) return this.validateWithoutChecking();
    }
  },

  /*
   * GoodForm.Validates is the preferred namespace for named validations.
   */
  Validates: {
    Base: function (args, configuration) {
      for (var argsAr = [], i = 0, len = args.length; i < len; ++i) // convert arguments to array
        argsAr.push(args[i]);
      var options = GoodForm.Helpers.extractOptions(argsAr);
      for (var name in options) configuration[name] = options[name];
      for (var i = 0, len = argsAr.length; i < len; ++i) {
        var validation = new GoodForm.Validation(argsAr[i], configuration);
        if (validation.initialize) validation.initialize();
        validation.register();
      }
    },

    /*
     * Encapsulates the pattern of wanting to validate the acceptance of a
     * terms of service check box (or similar agreement). Example:
     *
     *   Validates.Acceptance("terms_of_service");
     *   Validates.Acceptance("eula", { message: "must be abided" });
     *
     * Configuration options:
     *
     * - +message+ - A custom error message (default is: "must be
     *   accepted")
     * - +accept+ - Specifies value that is considered accepted. The default
     *   value is a string "1", which makes it easy to relate to an HTML
     *   checkbox.
     */
    Acceptance: function () {
      GoodForm.Validates.Base(arguments, {
        accept: 1,
        message: GoodForm.defaultErrorMessages.accepted,
        validate: function () {
          if (this.getValue()[0] != this.accept)
            return this.message;
        }
      });
    },

    /*
     * Encapsulates the pattern of wanting to validate a password or email
     * address field with a confirmation. Example:
     *
     *   Fields:
     *     <input id="email" name="email" type="text"/>
     *     <input id="email_confirmation" name="email_confirmation" type="text"/>
     *     <input id="password" name="password" type="password"/>
     *     <input id="password_confirmation" name="password_confirmation" type="password"/>
     *
     *   JavaScript:
     *     Validates.Confirmation("email");
     *     Validates.Confirmation("password", { message: "should match password" });
     *
     * NOTE: This check is performed only if the confirmation is not null.
     * To require confirmation, make sure to add a presence check for
     * confirmation attributes:
     *
     *   Validates.Presence("email_confirmation", "password_confirmation");
     *
     * Configuration options:
     *
     * - +message+ - A custom error message (default is: "doesn't match")
     *
     * ALSO NOTE: This validation differs from its Active Record
     * counterpart. Where Active Record validates the password against the
     * confirmation, GoodForm validates the confirmation against the
     * password:
     *
     *   Validates.Confirmation("password");
     *   document.getElementById("password_confirmation").value = "differ";
     *   Validate.All();
     *   Errors["password"]; // => null (returns "doesn't match confirmation" in Active Record)
     *   Errors["password_confirmation"]; // => ["doesn't match"]
     */
    Confirmation: function () {
      GoodForm.Validates.Base(arguments, {
        message: GoodForm.defaultErrorMessages.confirmation,
        initialize: function () {
          var confirmationId = this.element.id + "_confirmation";
          this.original = this.element;
          this.elements = new Array(document.getElementById(confirmationId));
          this.element  = this.elements[0], this.name = this.element.name;
        },
        validate: function () {
          if (this.original.value != this.getValue())
            return this.message;
        }
      });
    },

    /*
     * Validates that the value of the specified attribute is not in a
     * particular array.
     *
     *   Validates.Exclusion("username", { "in": ["admin", "superuser"], message: "You don't belong here" });
     *   Validates.Exclusion("format", { "in": ["mov", "avi"], message => "extension %s is not allowed" });
     *
     * Configuration options:
     *
     * - +"in"+ - An array of items that the value shouldn't
     *   be a part of.
     * - +message+ - Specifies a custom error message (default is: "is
     *   reserved")
     * - +allowNull+ - If set to true, skips this validation if the
     *   attribute is null (default is: false)
     * - +allowBlank+ - If set to true, skips this validation if the
     *   attribute is blank (default is: false)
     */
    Exclusion: function () {
      GoodForm.Validates.Base(arguments, {
        message: GoodForm.defaultErrorMessages.exclusion,
        validate: function () {
          var value = this.getValue();
          for (var i = 0, len = this["in"].length; i < len; ++i)
            if (value == this["in"][i])
              return this.message.replace(/%s/g, value);
        }
      });
    },

    /*
     * Validates whether the value of the specified attribute is of the
     * correct form by matching it against the regular expression provided.
     *
     *   Validates.Format("email", { "with": /^([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})$/i });
     *
     * A regular expression must be provided or else an exception will be
     * raised.
     *
     * Configuration options:
     *
     * - +message+ A custom error message (default is: "is invalid")
     * - +allowNull+ - If set to true, skips this validation if the
     *   attribute is null (default is: false)
     * - +allowBlank+ - If set to true, skips this validation if the
     *   attributeis blank (default is: false)
     * - +"with"+ - The regular expression used to
     *   validate the format with (note: must be supplied!)
     */
    Format: function () {
      GoodForm.Validates.Base(arguments, {
        message: GoodForm.defaultErrorMessages.invalid,
        validate: function () {
          if (!this["with"].test(this.getValue()))
            return this.message;
        }
      });
    },

    /*
     * Validates whether the value of the specified attribute is available
     * in a particular array.
     *
     *   Validates.Inclusion("gender", { inOption: ["m", "f"], message: "woah! what are you then!??!!" });
     *   Validates.Inclusion("format", { inOption: ["jpg", "gif", "png"], message: "extension %s is not included in the list" });
     *
     * Configuration options:
     *
     * - +"in"+ - An array of available items
     * - +message+ - Specifies a custom error message (default is: "is not
     *   included in the list")
     */
    Inclusion: function () {
      GoodForm.Validates.Base(arguments, {
        message: GoodForm.defaultErrorMessages.inclusion,
        validate: function () {
          var value = this.getValue();
          for (var i = 0, len = this["in"].length; i < len; ++i)
            if (value == this["in"][i]) return;
          return this.message.replace(/%s/g, value);
        }
      });
    },

    /*
     * Validates that the specified attribute matches the length
     * restrictions supplied. Only one option can be used at a time:
     *
     *   Validates.Length("first_name", { maximum: 30 });
     *   Validates.Length("last_name", { maximum: 30, message: "less than %d if you don't mind" });
     *   Validates.Length("fax", { inOption: [7, 32], allowNull: true });
     *   Validates.Length("phone", { inOption: [7, 32], allowBlank: true });
     *   Validates.Length("user_name", { within: [6, 20], tooLong: "pick a shorter name", tooShort: "pick a longer name" });
     *   Validates.Length("fav_bra_size", { minimum: 1, tooShort: "please enter at least %d character" });
     *   Validates.Length("smurf_leader", { is: 4, message: "papa is spelled with %d characters... don't play me." });
     *
     * Configuration options:
     *
     * - +minimum+ - The minimum size of the attribute
     * - +maximum+ - The maximum size of the attribute
     * - +is+ - The exact size of the attribute
     * - +within+ - An array specifying the minimum and maximum size of the
     *   attribute
     * - +"in"+ - Synonyms (aliases) for +within+
     * - +tooLong+ - The error message if the attribute goes over the
     *   maximum (default is: "is too long (maximum is %d characters)")
     * - +tooShort+ - The error message if the attribute goes under the
     *   minimum (default is: "is too short (min is %d characters)")
     * - +wrongLength+ - The error message if using the +is+ method and the
     *   attribute is the wrong size (default is: "is the wrong length
     *   (should be %d characters)")
     * - +message+ - The error message to use for a +minimum+, +maximum+,
     *   or +is+ violation. An alias of the appropriate
     *   too_long/too_short/wrong_length message
     *
     * This method is also aliased as Validates.Size()
     */
    Length: function () {
      GoodForm.Validates.Base(arguments, {
        initialize: function () {
          var range = this.within || this["in"];
          if (range)
            this.minimum = range[0], this.maximum = range[range.length - 1];
          else if (this.is)
            this.minimum = this.maximum = this.is;
        },
        validate: function () {
          var len = this.getValue().length;
          if (this.minimum == this.maximum && len != this.minimum)
            return (this.wrongLength || this.message ||
              GoodForm.defaultErrorMessages.wrongLength).replace(/%d/g, this.minimum);
          if (len < this.minimum)
            return (this.tooShort || this.message ||
              GoodForm.defaultErrorMessages.tooShort).replace(/%d/g, this.minimum);
          if (this.maximum && len > this.maximum)
            return (this.tooLong || this.message ||
              GoodForm.defaultErrorMessages.tooLong).replace(/%d/g, this.maximum);
      }});
    },


    /*
     * Validates whether the value of the specified attribute is numeric by
     * trying to convert it to a float with Math.parseFloat (if onlyInteger
     * is false) or applying it to the regular expression /^[+\-]?\d+$/ (if
     * onlyInteger is set to true).
     *
     *   Validates.Numericality("value");
     *
     * Configuration options:
     *
     * - +message+ - A custom error message (default is: "is not a number")
     * - +onlyInteger+ - Specifies whether the value has to be an integer,
     *   e.g. an integral value (default is false)
     * - +greaterThan+ - Specifies the value must be greater than the
     *   supplied value
     * - +greaterThanOrEqualTo+ - Specifies the value must be greater than
     *   or equal the supplied value
     * - +equalTo+ - Specifies the value must be equal to the supplied
     *   value
     * - +lessThan+ - Specifies the value must be less than the supplied
     *   value
     * - +lessThanOrEqualTo+ - Specifies the value must be less than or
     *   equal the supplied value
     * - +odd+ - Specifies the value must be an odd number
     * - +even+ - Specifies the value must be an even number
     */
    Numericality: function () {
      GoodForm.Validates.Base(arguments, {
        validate: function () {
          var value = this.getValue();
          if (this.onlyInteger && !value.match(/^[+\-]?\d+$/) || value != parseFloat(value))
            return this.message || GoodForm.defaultErrorMessages.notANumber;
          if (this.greaterThan !== undefined && value <= this.greaterThan)
            return this.message ||
              GoodForm.defaultErrorMessages.greaterThan.replace(/%d/g, this.greaterThan);
          if (this.greaterThanOrEqualTo !== undefined && value < this.greaterThanOrEqualTo)
            return this.message ||
              GoodForm.defaultErrorMessages.greaterThanOrEqualTo.replace(/%d/g, this.greaterThanOrEqualTo);
          if (this.equalTo !== undefined && value != this.equalTo)
            return this.message ||
              GoodForm.defaultErrorMessages.equalTo.replace(/%d/g, this.equalTo);
          if (this.lessThan !== undefined && value >= this.lessThan)
            return this.message ||
              GoodForm.defaultErrorMessages.lessThan.replace(/%d/g, this.lessThan);
          if (this.lessThanOrEqualTo !== undefined && value > this.lessThanOrEqualTo)
            return this.message ||
              GoodForm.defaultErrorMessages.lessThanOrEqualTo.replace(/%d/g, this.lessThanOrEqualTo);
          if (this.odd && value % 2 != 1)
            return this.message || GoodForm.defaultErrorMessages.odd;
          if (this.even && value % 2 != 0)
            return this.message || GoodForm.defaultErrorMessages.even;
        }
      });
    },

    /*
     * Validates that the specified attributes are not blank (as realized
     * by /^\s*$/.test(value). Example:
     *
     *   Validates.Presence("first_name");
     *
     * The first_name attribute cannot be blank.
     *
     * Configuration options:
     *
     * - +message+ - A custom error message (default is: "can't be blank")
     */
    Presence: function () {
      GoodForm.Validates.Base(arguments, {
        message: GoodForm.defaultErrorMessages.blank,
        validate: function () {
          if (/^\s*$/.test(this.getValue()))
            return this.message;
        }
      });
    },

    /*
     * Handles validation with Ajax should the server be consulted for
     * validity.
     *
     * E.g., if email addresses must be unique:
     *
     *   Validates.Ajax("email");
     *
     * When the item is validated, a "GET" request is sent to the path
     * specified by Validates.Base.AjaxPath, with the item's attributes 
     * serialized in a query string. The server should respond with a JSON
     * string of name-value pairs reflecting the name attribute of the item
     * validated, and the status of the validation. Invalid items should
     * return an array of error messages. Valid items should return null,
     * or a custom string stating validity:
     *
     *   { email: ["is invalid"] } // Invalid
     *   { email: null }           // Valid
     *   { email: "OK" }           // Valid with message
     *
     * Configuration options:
     *
     * - +include+ - one or more elements, element names, or parameters in
     *   the form of "name=value".
     */
    Ajax: function () {
      GoodForm.Validates.Base(arguments, { remote: true, include: [],
        validate: function () {
          GoodForm.Validate.ajaxQuery[this.name] = this.getValue();
          for (var i = 0, len = this.include.length; i < len; ++i) {
            var pair = this.include[i].split("=");
            if (!pair[1]) pair.push(GoodForm.Helpers.getValuesByName(pair[0]));
            GoodForm.Validate.ajaxQuery[pair[0]] = pair[1];
          }
        }
      });
    },

    /*
     *   Validates.AdHoc("number", { "with": function (value) { return value == 1; }, message: "ones only" });
     */
    AdHoc: function () {
      GoodForm.Validates.Base(arguments, { validate: function () {
        if (!this["with"](this.getValue())) return this.message || "invalid";
      }});
    }
  },

  Validate: {
    /*
     * This object holds the parameters for an ajax query to be executed,
     * allowing multiple ajax validations to queue up before the request is
     * sent.
     */
    ajaxQuery: {},

    /*
     * Keeps track of validation responses over the course of a validation.
     * Both local and remote responses are stored here.
     */
    responses: {},

    /*
     * Keeps track of validation callbacks over the course of a validation.
     */
    callbacks: {},

    /*
     * Validates a form item by name.
     *
     *   Validate("login");
     *
     * Configuration options:
     *
     * - +defer+ - Hold validation response in the queue.
     * - +remote+ - Run remote validations (default: true).
     * - +scope+ - Only run under the scope of a single form.
     */
    Name: function (input, options) {
      var name = typeof input == "string" ? input : input.name;
      options = GoodForm.Helpers.extractOptions(options);
      if (!options.defer)
        GoodForm.Validate.responses = {}, GoodForm.Validate.callbacks = {};
      if (!(options.remote !== false) || !GoodForm.Validate.Queue(name, { remote: true }))
        var response = GoodForm.Validate.Queue(name, { remote: false });
      if (!options.defer) return GoodForm.Validate.Run();
      return response;
    },

    /*
     * Queues up validations. Remote validations queue up in Validate.ajaxQuery
     * till the Ajax response. All validations end up in Validate.response.
     */
    Queue: function (name, options) {
      var type = options.remote ? "remote" : "local";
      var validations = GoodForm[type][name], errors = [];
      if (!validations) return false;
      for (var i = 0, len = validations.length; i < len; ++i) {
        var validation = validations[i];
        if (options.scope && validation.form != options.scope) return;
        var error = validation.validate();
        if (error) { // Handle callbacks
          GoodForm.Validate.responses[name] =
            (GoodForm.Validate.responses[name] || []).concat(error);
          if (validation.onError) GoodForm.Validate.callbacks[name] =
            (GoodForm.Validate.callbacks[name] || []).concat(validation.onError);
        } else if (validation.onValid) GoodForm.Validate.callbacks[name] =
            (GoodForm.Validate.callbacks[name] || []).concat(validation.onValid);
      }
      if (!GoodForm.Validate.responses[name] && type == "local")
        GoodForm.Validate.responses[name] = GoodForm.validMessages[name] ||
          GoodForm.validMessage;
      return GoodForm.Validate.responses[name];
    },

    /*
     * Runs every validation on the page (can be scoped with one argument
     * to a specific form).
     */
    All: function (form, options) {
      options = GoodForm.Helpers.extractOptions(options);
      GoodForm.Validate.responses = {}, GoodForm.Validate.callbacks = {};
      if (options.remote !== false)
        for (var name in GoodForm.remote)
          GoodForm.Validate.Name(name, { remote: true, defer: true, scope: form });
      for (var name in GoodForm.local)
        // if (!GoodForm.Validate.ajaxQuery[name])
          GoodForm.Validate.Name(name, { remote: false, defer: true, scope: form });

      return GoodForm.Validate.Run();
    },

    /*
     * Runs a local validation silently. Returns true if valid, false if not.
     */
    Local: function (name) {
      for (var i = 0; v = GoodForm.local[name][i]; ++i)
        if (v.validate()) return false;
      return true;
    },

    /*
     * Runs an ajax validation with the values populated in the queue.
     */
    Remote: function () {
      var params = [];
      for (var name in GoodForm.Validate.ajaxQuery) {
        var values = [].concat(GoodForm.Validate.ajaxQuery[name]);
        for (var i = 0; value = values[i]; ++i)
          params.push(name + "=" + encodeURIComponent(value));
      }
      if (params.length < 1) return false;
      var t, loadingState;
      try { t = new XMLHttpRequest(); } catch(e) {
      try { t = new ActiveXObject('Msxml2.XMLHTTP'); } catch(e)
        { t = new ActiveXObject('Microsoft.XMLHTTP'); }};

      t.onreadystatechange = function () {
        if (t.readyState == 4 && t.status >= 200 && t.status < 300) {
          eval("var json = " + t.responseText);
          for (var name in json)
            if (name == "__eval__")
              eval(json[name]);
            else
              new GoodForm.Validate.Effect(name, json[name]);
          for (var name in GoodForm.Validate.responses)
            if (!json[name])
              new GoodForm.Validate.Effect(name, GoodForm.Validate.responses[name]);
        } else if (!loadingState)
          for (var name in GoodForm.Validate.ajaxQuery)
            new GoodForm.Validate.Effect(name); // No response: loading
      }

      var baseUri = location.protocol + "//" + location.host + GoodForm.remotePath;
      t.open("GET", baseUri + "?" + params.join("&"), true);
      t.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      t.send(null);
      return true;
    },

    /*
     * A GoodForm.Validate.Effect object is created whenever validation is
     * run.
     *
     * By default, it looks for an element matching the form element's
     * name, plus "_validation". E.g., for "phone_number" it would look for
     * "phone_number_validation". If this element isn't found, it creates
     * a span and inserts it into the DOM directly after the form element.
     *
     * Names are passed through GoodForm.Helpers.underscore to keep the DOM
     * valid: "user[email]" becomes, therefore, "user_email_validation".
     *
     * Upon validation, this element is given a className of "valid",
     * "error", or, during the loading phase of an Ajax request, "loading".
     *
     * Override this function to customize visual validation. It accepts
     * two arguments:
     *
     *   - +name+ - The validated form item name.
     *   - +response+ - The validation response. Invalid objects return an
     *     array of error messages; valid objects return null or a preset
     *     valid string.
     */
    Effect: function (name, response) {
      if (el = GoodForm.Helpers.findOrCreateValidationSpan(name)) {
        var status = GoodForm.Helpers.parseResponse(response);
        el.className = "good_form " + status;
        switch (status) {
          case ("loading"):
            el.innerHTML = GoodForm.loadingMessage;
            break;
          case ("valid"):
            el.innerHTML = response || GoodForm.validMessages[name] || GoodForm.validMessage;
            break;
          case ("error"):
            el.innerHTML = response.join(", ");
            break;
        }
      }
    },

    /*
     * Applies queued and local validation responses.
     */
    Run: function (options) {
      var response;
      var status = true, options = GoodForm.Helpers.extractOptions(options);
      if (GoodForm.Validate.ajaxQuery && !GoodForm.Validate.Remote()) {
        for (var name in GoodForm.Validate.responses) {
          response = GoodForm.Validate.responses[name];
          new GoodForm.Validate.Effect(name, response);
          if (GoodForm.Helpers.parseResponse(response) != "valid")
            status = false;
        }
        for (var name in GoodForm.Validate.callbacks)
          for (var i = 0, len = GoodForm.Validate.callbacks[name].length; i < len; ++i)
            GoodForm.Validate.callbacks[name][i]();
      }
      GoodForm.Validate.ajaxQuery = {};
      return status;
    }
  },

  Helpers: {
    /*
     * Returns the last object out of an array of arguments. If no object
     * exists, a new object is returned.
     */
    extractOptions: function (input) {
      if (input) {
        if (input.constructor == Object) return input;
        else if (input.constructor == Array) {
          var last = input[input.length - 1];
          if (last && last.constructor == Object) return input.pop();
        }
      }
      return {};
    },

    getElements: function (input) {
      if (typeof input == "string") {
        var elements = document.getElementsByName(input);
        if (elements.length == 0) var element = document.getElementById(input);
        else return elements;
        if (element) return new Array(element);
      } else if (typeof input == "object") return new Array(input);
    },

    extractName: function (input) {
      var el;
      if (input.name)
        return input.name;
      else if (el = document.getElementById(input))
        return el.name;
      else
        return input;
    },

    /*
     * Returns a validation span for GoodForm.Validate.Effect, creating a new
     * one if it does not exist.
     */
    findOrCreateValidationSpan: function(name) {
      var vEl, fEl, id = GoodForm.Helpers.underscore(name) + "_validation";
      if (vEl = document.getElementById(id)) return vEl;
      vEl = document.createElement("span");
      vEl.id = id;
      var fEls = document.getElementsByName(name);
      if (fEl = fEls[fEls.length - 1]) {
        fEl.parentNode.insertBefore(vEl, fEl.nextSibling);
        return vEl;
      }
    },

    /*
     * Returns an array of values for a form item name. If only one value
     * is available, it will be returned in a string. No values will return
     * null.
     */
    getValuesByName: function (name, form) {
        var els = document.getElementsByName(name), values = [];
        if (form && form.constructor == String)
          form = document.getElementById(form);
        for (var i = 0, len = els.length; el = els[i]; ++i)
          if (!form || form == el.form)
            if (el.checked || !/checkbox|radio/.test(el.type))
              values.push(el.value);
            else if (len == 1)
              values.push(""); // For the unchecked
        return values.length > 1 ? values : values[0];
    },

    /*
     * Parses a response to see if a validation passed, failed, or is still
     * loading. Error messages come in an array. Valid messages are
     * strings. If the response is undefined, it is still loading.
     */
    parseResponse: function (response) {
      if (response == undefined)
        return "loading";
      if (response.constructor == Array && response.length > 0)
        return "error";
      else
        return "valid";
    },

    /*
     * Consolidates each set of invalid characters in a string to an
     * underscore. The string will retain alphanumerical start and end
     * points.
     *
     *   GoodForm.Helpers.underscore("user[email]"); // => "user_email"
     */
    underscore: function (string) {
      return string.toLowerCase().replace(/[^\w]+/g, "_").
                    replace(/^_+|_+$/g, "");
    }
  }
}

/*
 * Alias for Validates.Length
 */
GoodForm.Validates.Size = GoodForm.Validates.Length;

/*
 * Top-level aliases
 */
var Validates = GoodForm.Validates;
var Validate = $V = GoodForm.Validate.Name;
Validate.All = GoodForm.Validate.All;
Validate.Local = GoodForm.Validate.Local;
