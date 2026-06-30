# 🚀 Smart Mail & Job Application Center

Une application web moderne, fluide et intelligente pour centraliser vos e-mails de recherche d'emploi et suivre automatiquement vos candidatures. 

L'application intègre une **IA (Ollama locale ou un moteur de règles linguistique puissant)** qui analyse l'objet et le contenu de vos e-mails pour les trier, les relier à vos candidatures en cours, et en mettre à jour le statut (En cours, Invité à un entretien, Refusé, Offre acceptée).

---

## ✨ Fonctionnalités clés

1. **📬 Centralisation des E-mails**
   - Connexion IMAP sécurisée à votre boîte mail personnelle (Gmail, Outlook, etc.).
   - Consultation et lecture des e-mails directement dans l'application.
   - Système de recherche textuelle et filtrage par dossiers automatiques.

2. **🧠 Tri Automatique par Intelligence Artificielle**
   - **Mode IA (Ollama)** : Analyse contextuelle sémantique de l'e-mail. Détection automatique de l'expéditeur, du poste, et de l'état de la candidature.
   - **Mode Moteur de Règles (Fallback)** : Moteur d'analyse linguistique local analysant les mots-clés français et anglais pour assurer un tri 100% fonctionnel hors-ligne ou si Ollama n'est pas démarré.
   - **Mises à jour automatiques** : Un email de refus bascule automatiquement l'offre sur "Refusé". Une invitation à un entretien passe le statut de l'offre à "Entretien".

3. **💼 Tableau de Bord & Suivi des Offres**
   - Tableau interactif recensant toutes les offres postulées (Entreprise, Poste, Lieu, Date, Statut).
   - Historique des e-mails : En cliquant sur une offre, vous voyez l'historique complet des e-mails échangés avec cette entreprise.
   - Ajout, modification et suppression manuelle de candidatures.
   - Liaison manuelle facilitée des e-mails à une offre existante directement depuis la boîte de réception.

4. **⚙️ Paramètres Avancés**
   - Configuration graphique des identifiants IMAP.
   - Outil de test de connexion IMAP en un clic.
   - Activation et configuration d'Ollama (choix du modèle, adresse IP locale).

---

## 🏃 Démarrage Rapide

### 1. Lancer l'application
Exécutez simplement le script de démarrage situé à la racine du projet :
```bash
./start.sh
```
Ce script lance simultanément :
- Le serveur **Backend** Express sur `http://localhost:5000` (avec la base de données SQLite auto-générée dans `backend/data/mail_tracker.db`).
- Le serveur de développement **Frontend** Vite + React sur `http://localhost:5173`.

### 2. Accéder à l'interface
Ouvrez votre navigateur sur : **[http://localhost:5173](http://localhost:5173)**

---

## 🔒 Configuration de la messagerie

### Utiliser Gmail (Recommandé avec clé d'application)
Si vous connectez une adresse Gmail, Google bloque les mots de passe standards pour des raisons de sécurité. Vous devez utiliser un **Mot de passe d'application** :
1. Accédez à la sécurité de votre compte Google ([myaccount.google.com/security](https://myaccount.google.com/security)).
2. Activez la **Validation en deux étapes** si ce n'est pas déjà fait.
3. Allez dans la section **Mots de passe d'application** (tout en bas de la page ou via la barre de recherche).
4. Saisissez un nom (ex: "Smart Mail Tracker") et cliquez sur **Créer**.
5. Copiez le code à 16 caractères généré et collez-le dans le champ *Mot de passe* des Paramètres de l'application.
6. Utilisez les paramètres IMAP suivants :
   - **Serveur IMAP** : `imap.gmail.com`
   - **Port IMAP** : `993`
   - **Sécurité** : `Activé (SSL/TLS)`

---

## 🤖 Configuration d'Ollama (IA Locale)

Pour utiliser la classification intelligente avancée :
1. Assurez-vous qu'Ollama est installé et tourne sur votre machine.
2. Téléchargez le modèle de votre choix (ex: `llama3` ou `mistral`) :
   ```bash
   ollama run llama3
   ```
3. Dans l'application, allez dans **Paramètres**.
4. Cochez **Activer l'IA Ollama locale**.
5. Renseignez l'URL (`http://localhost:11434` par défaut) et le nom exact du modèle (`llama3`).
6. Cliquez sur **Enregistrer l'IA**.
