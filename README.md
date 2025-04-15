# Integration with Drupal OAuth Authentication

This guide will help you set up and configure OAuth authentication with a Drupal backend for your frontend application.

## 1. Authentication Flow

### Step 1: User Login

1. **Frontend**: The user is directed to the Drupal OAuth authorization endpoint.
   - URL: `https://<your-drupal-site>/oauth/authorize`
   - The frontend application requests access to the user's data by redirecting them to this endpoint, where the user will be prompted to grant or deny permission.

2. **OAuth Server**: If the user grants access, the OAuth server redirects back to the frontend application with an authorization code.
   - Redirect URL: The URL where the authorization code is sent after successful authorization.
   - Example: `https://your-frontend-app.com/callback?code=AUTHORIZATION_CODE`

3. **Frontend**: The frontend sends the authorization code to the Drupal backend to exchange it for an access token.
   - URL: `https://<your-drupal-site>/oauth/token`
   - The frontend includes the authorization code, client ID, client secret, and the redirect URI in the request.

### Step 2: Token Exchange

1. **Backend**: The frontend sends a POST request to Drupal's token endpoint to exchange the authorization code for an access token.
   - The request body contains:
     - `grant_type=authorization_code`
     - `code=AUTHORIZATION_CODE`
     - `client_id=YOUR_CLIENT_ID`
     - `client_secret=YOUR_CLIENT_SECRET`
     - `redirect_uri=YOUR_REDIRECT_URI`

2. **OAuth Server**: Drupal verifies the code, client ID, and secret, then responds with the access token and refresh token.
   - Example Response:
     ```json
     {
       "access_token": "ACCESS_TOKEN",
       "token_type": "bearer",
       "expires_in": 3600,
       "refresh_token": "REFRESH_TOKEN"
     }
     ```

### Step 3: Accessing Protected Resources

1. **Frontend**: The frontend now includes the access token in the Authorization header of API requests to protected resources.
   - Example Request:
     ```http
     GET /api/user
     Authorization: Bearer ACCESS_TOKEN
     ```

2. **Backend**: Drupal validates the token and returns the requested resource if valid.

### Step 4: Token Refresh

1. **Frontend**: When the access token expires, the frontend sends a request to the token endpoint with the refresh token to get a new access token.
   - Example Request:
     ```http
     POST /oauth/token
     Content-Type: application/x-www-form-urlencoded
     grant_type=refresh_token
     refresh_token=REFRESH_TOKEN
     client_id=YOUR_CLIENT_ID
     client_secret=YOUR_CLIENT_SECRET
     ```

2. **OAuth Server**: Drupal verifies the refresh token and responds with a new access token and refresh token.

## 2. Configurations to be Made on Drupal Side

### Step 1: Enable the OAuth Module

- Install and enable the OAuth module on your Drupal site. You can do this through the Drupal admin interface or via Drush (Drupal command-line tool).
  ```bash
  drush en oauth
  ```

### Step 2: Create an OAuth Consumer

    1. Navigate to Administer > Configuration > Web services > OAuth Consumers.

    2. Click Add OAuth Consumer.

    3. Enter a name for the consumer (e.g., "Frontend App").

    4. Set permissions for the consumer, specifying the scope of access (e.g., user for user profile access).

    5. Save the configuration. The system will generate a Client ID and Client Secret for this consumer.

### Step 3: Configure Scopes

    1. Define the OAuth scopes for the consumer to specify what resources the frontend can access. Common scopes include user, content, or custom scopes depending on your use case.

    2. Set the appropriate permissions for the roles that the consumer will authenticate.

## 3. Setup .env File and Running Project Locally
### Step 1: Setup the .env File
    Create a .env file in your root project directory and add the following configuration parameters:
        NEXT_PUBLIC_API_URL=The URL of your Drupal backend (use the appropriate URL for your local or live environment).
        DRUPAL_OAUTH_CLIENT_ID=The Client ID generated when creating the OAuth consumer in Drupal.
        DRUPAL_CLIENT_SECRET=The Client Secret associated with your OAuth consumer.

### Step 2: Running the Project Locally
To run your project locally, follow these steps:
Clone the repository and navigate into the project folder:

```bash
git clone https://github.com/jinks8010/Next-Drupal-Auth-Scratch
cd Next-Drupal-Auth-Scratch
npm install
npm run dev
```
Open your browser and navigate to http://localhost:3000 (or the appropriate local URL) to see your application running.

