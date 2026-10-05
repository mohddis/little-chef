# Little Chef by Pista House — Website

Bake • Learn • Smile. A one-page website for the Little Chef educational bakery experience.

## Files

```
CNAME                    Connects the site to www.littlechefs.in
index.html               The whole website (HTML, CSS and JavaScript in one file)
assets/                  Logo, mascot, illustrations and icons (WebP)
google-apps-script.gs    Optional: sends booking requests to a Google Sheet
```

## Put it online with GitHub Pages

1. Create a new repository on GitHub, for example `little-chef-website`.
2. Click **Add file > Upload files**, drag in `index.html`, `README.md`,
   `google-apps-script.gs` and the whole `assets` folder, then **Commit changes**.
3. Go to **Settings > Pages**. Under *Build and deployment*, choose
   **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. After a minute the site is live. Once the domain step below is done, it opens at https://www.littlechefs.in

### Connect your domain (www.littlechefs.in)
The `CNAME` file in this folder already points the site to `www.littlechefs.in`.
After uploading, check **Settings > Pages > Custom domain** shows `www.littlechefs.in`.
At your domain provider, add a **CNAME** record: `www` → `<your-username>.github.io`.
Tick **Enforce HTTPS** once it becomes available.

## Booking requests — how the team receives them

The booking form works in one of two ways. Choose at the top of the `<script>`
section in `index.html`:

```js
var FORM_ENDPOINT = "";              // Google Sheet web app URL (recommended)
var WHATSAPP_NUMBER = "919133308091"; // used when FORM_ENDPOINT is empty
```

- **WhatsApp (works immediately):** with `FORM_ENDPOINT` empty, pressing
  *Request booking* opens WhatsApp with every detail filled in, sent to
  +91 91333 08091.
- **Google Sheet (recommended for the team):** follow the steps at the top of
  `google-apps-script.gs`, then paste the web app URL into `FORM_ENDPOINT`.
  Every school or parent request becomes a new row in the sheet, with a
  *Status* column your team can update. Share the sheet with the team.

## Things to update

- **Social links:** in the footer, replace `href="#"` on Instagram, YouTube and Facebook.
- **Gallery photos:** add real photos to `assets/gallery/` and follow the comment above
  the gallery list in `index.html`. Use bright, natural photos and only with
  parent or school permission, as the brand guidelines require.
- **Contact details:** phone, email and address appear in the booking section and footer.
