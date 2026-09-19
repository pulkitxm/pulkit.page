---
title: Typewriter Effect in React
description: Learn how to create a typewriter effect in React with this step-by-step guide. Engage
  your audience with nostalgic charm
date: 2024-04-28
tags:
  - React
  - Typewriter Effect
  - React Hooks
  - UI Components
  - Frontend
---

Adding interesting features to your website can grab your audience's attention in today's fast digital world. The typewriter effect, like old typewriters, is a delightful touch that can make your web content more lively. In this guide, we will show you how to create this nostalgic effect using React, making your website more dynamic and engaging for users.

**Prerequisites:**

- Node.js and npm (or yarn) are installed on your system.

*For this walkthrough, you'll be creating a React project using Vite and Tailwind CSS for styling. While these are my preferred choices, you can absolutely tailor the setup to your existing project or preferences.*

## Setting up the App

- Create an empty React project
  ```plaintext
  pnpm create vite@latest react-typewiter -- --template react
  ```
- Install Dependencies
  ```plaintext
  cd react-typewiter
  yarn
  ```
- Start the development server:
  ```plaintext
  yarn dev
  ```

![Vite React app running in browser](/assets/content/blogs/step-by-step-guide-to-implementing-typewriter-effect-in-react/296bc3f4-3dae-406f-9b02-8f821399fad5.webp)

## **Creating the Typewriter Component**

*src/components/Typewriter.jsx*

```jsx
import PropTypes from "prop-types";

const Typewriter = ({ text }) => {
  return <div>{text}</div>;
};

export default Typewriter;
Typewriter.propTypes = {
  text: PropTypes.string.isRequired,
};
```

*Import Typewriter Component*

```jsx
import Typewriter from "./src/components/Typewriter";

function App() {
  return (
    <div>
      <Typewriter text={"Hello World"} />
    </div>
  );
}

export default App;
```

## Typewriter Logic

Initialize a useState index for maintaining the typed words

```jsx
const [currentIndex, setCurrentIndex] = useState(0);
```

Now to maintain the `currentIndex` to go from 0 to `text.length` , Introduce a useEffect hook. What could be an easy way to do that? Of course, a setInterval could do the job.

```jsx
useEffect(() => {
  const interval = setInterval(() => {
    setCurrentIndex((prevIndex) => {
      if (prevIndex === text.length) {
        clearInterval(interval);
        return prevIndex;
      }
      return prevIndex + 1;
    });
  }, 100);
  return () => clearInterval(interval);
}, [text]);
```

But we're not utilizing the currentIndex in the Component. We could simply slice the string according to the currentIndex.

```jsx
text.substring(0, currentIndex);
```

![Typewriter effect animation showing text appearing character by character](/assets/content/blogs/step-by-step-guide-to-implementing-typewriter-effect-in-react/746c7b25-e1fe-4899-9efe-fad41d734ac2.gif)

*Yay, it's complete!*

---

This is my first article! 🥳

I would love to hear your feedback. Feel free to share your thoughts! If you found this useful and want more similar content, I'm happy to write about other features or components.

I've also added custom props like speed, color, onComplete, blinkRate, cursorChar (to change the blinking character, currently set as '|'), pauseOnHover to this component. If you'd like explanations on how these are implemented, please let me know in the comments.

I hope you enjoyed reading. 🤍
