const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

// Configure Google OAuth2 strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: '34475131694-205neii8udelbicj7nvl664jmn8g8o04.apps.googleusercontent.com',
            clientSecret: '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',
            callbackURL: 'http://localhost:3000/auth/google',
        },
        (accessToken, refreshToken, profile, done) => {
            // Handle the user profile data and authentication
            // You can save the user profile to your database and issue JWT tokens

            // Call the 'done' callback to continue the authentication process
            // You can pass additional data to the callback, such as the user profile
            done(null, profile);
        }
    )
);

// Serialize user profile
passport.serializeUser((user, done) => {
    done(null, user);
});

// Deserialize user profile
passport.deserializeUser((user, done) => {
    done(null, user);
});
