# Writing Your Own Auth-Plugins for npm Enterprise

npmE launched with authorization that's tightly integrated with GitHub Enterprise:

* you login to npmE using your GitHub credentials.
* you can publish modules that correspond to GitHub repos you have write access for.
* you can install modules that correspond to GitHub repos that you have read access for.

This has been great for companies who use GHE, but overlooks people using other types authorization e.g., LDAP.

In prep for supporting a wider of variety auth-strategies, we're open-sourcing npmE's auth-plugin architecture.

Here's what you need to know to write a custom authentication strategy for npm Enterprise:

## Getting Started

An auth-strategy is published as an npm module. Your package should contain the following files:

* **package.json:** meta information about the auth-plugin you're building.
* **authenticator.js:** the logic for handling user logins.
* **authorizer.js:** the logic for handling reading and publishing packages.
* **index.js:** the main entry point for a plugin.

## index.js

The index.js file is the file loaded by npmE, it should have the following content:

```javascript
exports.Authenticator = require('./authenticator.js');
exports.Authorizer = require('./authorizer.js');
```

## Writing an Authenticator

An authenticator handles the user's initial login:

`npm login --scope=@myregistry --registry=http://my-npme:8080`

The authenticator need only expose the single method `authenticate`. Here's an example:

```javascript
function FooAuthenticator() {}

FooAuthenticator.prototype.authenticate = function(credentials, cb) {};

module.exports = FooAuthenticator;
```

The authenticate method receives a `credentials` object, and a `cb` to execute once authentication is complete.

### The Credentials Object

The credentials object contains the username, password, and email provided via `npm login`:

```json
{
  "body": {
    "name": "foo",
    "password": "bar",
    "email": "ben@example.com"
  }
}
```

This login information can then be validated against an arbitrary service, such as your company's LDAP server.


### The Callback

If the login fails, execute `callback` with an error object:

```javascript
return cb(Error('invalid login'));
```

If a login is successful it's your responsibility to:

1. issue a token to associate with the user.
2. provide a user object to be cached by npmE.

```javascript
cb(null, {
  token: 'foo-token',
  user: {
    email: credentials.body.email,
    name: credentials.body.name
  }
})
```

### Issuing a Token

The token you issue should be a unique identifier which allows you to associate future installs and publications with the authenticated user. This is the value that will be stored in the user's `.npmrc`.

In the case of [npme-auth-githb](https://github.com/npm/npme-auth-github), a GitHub application-token is returned. This can be used to authorize future requests against the GitHub API.

## Writing an Authorizer

An authorizer handels package installs and publications. To create an authorizer, simply implement the `authorize` method:

```javascript
function FooAuthorizer(config) {};

FooAuthorizer.prototype.authorize = function(request, cb) {
};

module.exports = FooAuthorizer;
```

The authenticate method receives a request object and a cb to execute once authorization is complete.

## The Request Object

The request object provided to `authorize` contains four important pieces of information:

* **`request.path`:** a path representing the package authorization is being performed for.
* **`request.method`:** the type of request being authorized: `GET` for reads, `PUT` for publishes.
* **`request.body:`** the package.json contents (this is only sent for publishes).
* **`request.headers.authorization:`** contains the token issued by the authenticator.

## The Callback

If an error occurs during authorization, `cb` should be executed with an error object:

```javascript
return cb(Error('could not connect to LDAP'));
```

Otherwise `cb` should be executed with a `true` or `false` value, depending on whether or not authorization is successful:

```javascript
return cb(null, true); // authorization was successful.
```

## Looking up a Package

The information stored in `request.body` could potentially contain information that changes package permissions.

In the case of [npme-auth-githb](https://github.com/npm/npme-auth-github), we use the `repository` field in the package.json to determine who has write permissions for a package. After the initial package publication, the contents of `request.body` should not be trusted. Instead, you should use `request.path` to fetch the last version of the package that was published:

```javascript
FooAuthorizer.prototype.loadPackageJson = function(request, cb) {
  request.get(this.frontDoorHost + request.path.split('?')[0] + '?sharedFetchSecret=' + this.sharedFetchSecret, {
    json: true
  }, function(err, response, package) {
    if (err) return cb(err);
    else return cb(null, response, package);
  });
};
```

## Publishing and Installing Your Auth-Plugin

1. publish your auth-plugin to npm, with the following naming convention:
  * `npme-auth-[my-plugin-name]`.

2. edit your npm Enterprise server's configuration to reference the custom plugin:

```json
{
  "args": {
    "--authentication-method": "foo",
    "--authorization-method": "foo",
    "--session-handler": "redis"
  }
}
```

3. install your auth-plugin, `cd /etc/npme; npm install npme-auth-foo`.
4. regenerate npmE's run-scripts and restart npme, `npme generate-scripts; npme restart`.

## Some Examples of Auth-Plugins

The example code used in this post is taken from the [npme-auth-foo](https://github.com/bcoe/npme-auth-foo) auth-strategy.

For a more thorough working example, check out the [npme-auth-github](https://github.com/npm/npme-auth-github) auth strategy. This is default auth approach currently used by npm Enterprise.

That's all you need to know to start writing your own auth-plugins for npm Enterprise!

I can't wait to see what people come up with.
