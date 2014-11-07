var _ = require('lodash'),
  request = require('request');

function FooAuthorizer(config) {
  // the service.json config settings are passed
  // in when the authorizer is initialized.
  _.extend(this, config);
};

// authorize reading or publishing a package.
FooAuthorizer.prototype.authorize = function(request, cb) {
  if (request.method === 'PUT') { // package publish.
    this.authPublish(request, cb);
  } else { // package read.
    this.authRead(request, cb);
  }
};

// the stored token for a user comes in with the Bearer header.
FooAuthorizer.prototype.token = function(request) {
  return request.headers.authorization.replace('Bearer ', '');
};

// we can't trust the information that the user passes to us,
// we should load the most recently published version of the package
// we're interacting with, and use this as a basis for auth.
FooAuthorizer.prototype.loadPackageJson = function(request, cb) {
  request.get(this.frontDoorHost + request.path.split('?')[0] + '?sharedFetchSecret=' + this.sharedFetchSecret, {
    json: true
  }, function(err, response, package) {
    if (err) return cb(err);
    else return cb(null, response, package);
  });
};

FooAuthorizer.prototype.authPublish = function(request, cb) {
  // only users with the token 'foo-token' can publish the package '@foo/bar'.
  // no other packages can be published.
  // NOTE: in reality, we should first call loadPackageJson and make sure
  // that the user has access to the given package.
  if (this.token(request) === 'foo-token' && request.body.name === '@foo/bar') {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

FooAuthorizer.prototype.authRead = function(request, cb) {
  // reads receive only the path to the package.json, we
  // can use this to lookup the package meta-information.
  this.loadPackageJson(request, function(err, response, package) {
    if (package.name === '@foo/bar') return cb(null, true);
    else return cb(null, false);
  });
};

module.exports = FooAuthorizer;
