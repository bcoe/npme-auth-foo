function FooAuthenticator() {}

// authenticate a user `npm login --scope=@myscope --registry=myregistry`
FooAuthenticator.prototype.authenticate = function(credentials, cb) {
  if (credentials.body.name === 'foo' && credentials.body.password === 'bar') {
    cb(null, {
      token: 'foo-token', // a unique identifier for the user, stored in .npmrc.

      // associate a username and email with the
      // token you provide, this information will be
      // used when publishing packages using the token returned.
      user: {
        email: credentials.body.email,
        name: credentials.body.name
      }
    })
  } else {
    cb(Error('incorrect password'));
  }
};

module.exports = FooAuthenticator;
