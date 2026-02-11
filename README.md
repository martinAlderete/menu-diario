# menu-abuela (PHONE via GitHub Secrets)

Este proyecto genera una página diaria (GitHub Pages) con botón para enviar el menú por WhatsApp.
El número NO está en el repo: se inyecta vía Secret `PHONE`.

## Pasos
1) Subí el repo a GitHub
2) Settings → Secrets and variables → Actions → New secret
   - Name: PHONE
   - Value: 54911XXXXXXXX
3) Activá GitHub Pages desde /docs
