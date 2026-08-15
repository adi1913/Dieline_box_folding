# 📦 Dieline Box Visualizer

An interactive **React + Three.js** application that converts a **2D box dieline** into a realistic **3D folding box**.

Users can upload a dieline image, generate a 3D model, rotate it freely, and watch the box fold from a flat layout into its final shape.

deploy link : https://dieline-box-folding.vercel.app/

---

## ✨ Features

* 📤 Upload PNG or JPG dieline images
* 🧩 Automatic panel detection
* 📐 Fold line identification
* 📦 Interactive 3D box generation
* 🎬 Smooth folding animation
* 🖱️ Rotate, zoom, and inspect the model
* 📱 Responsive and clean user interface

---

## 🛠️ Tech Stack

* ⚛️ React
* ⚡ Vite
* 🌐 Three.js
* 🟨 JavaScript
* 🎨 HTML5 Canvas

---

## 📂 Project Structure

```text
src/
├── App.jsx                 # Main application
├── FoldScene.jsx           # Three.js scene & folding animation
├── dielineParser.js        # Dieline parsing logic
├── App.css
├── index.css
└── main.jsx
```

---

## 🚀 Getting Started

### 📥 Clone the Repository

```bash
git clone <your-repository-url>
cd dieline-box
```

### 📦 Install Dependencies

```bash
npm install
```

### ▶️ Run the Project

```bash
npm run dev
```

Open the local development URL displayed in your terminal.

---

## ⚙️ How It Works

### 🖼️ Dieline Parsing

The uploaded image is analyzed to detect:

* 📋 Individual box panels
* 📏 Fold (crease) lines
* 🔗 Panel connectivity

The parser builds a fold hierarchy that is later used for animation.

### 🏗️ 3D Model Generation

Each detected panel is converted into a separate **Three.js** plane. The panels are connected through hinge relationships to recreate the structure of a real folding carton.

### 🎥 Folding Animation

The application rotates connected panels around their hinge edges, creating a smooth animation from a flat dieline to a closed 3D box.

---

## ⚠️ Current Limitations

* 🖼️ Supports PNG and JPG uploads
* 📄 PDF files should be exported as images before uploading
* ✨ Best results are achieved with clean, high-contrast dielines

---

## 🚧 Future Improvements

* 📄 Native PDF support
* 📦 Better handling of complex packaging layouts
* 🎨 Custom textures and materials
* 💾 Export generated 3D models
* 📚 Support for additional box templates

---

## 👨‍💻 Author

**Adi**

Built as part of a **Frontend Engineering Challenge** using **React** and **Three.js**.

⭐ If you found this project useful, consider giving it a star!
