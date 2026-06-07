export const updateMetaTags = ({ title, description, image, url }) => {
  // Update document title
  if (title) {
    document.title = `${title} | Inmos`;
  }

  // Helper function to update or create a meta tag
  const setMetaTag = (selector, attribute, content) => {
    let element = document.querySelector(selector);
    if (!element) {
      element = document.createElement('meta');
      if (selector.includes('name=')) {
        element.setAttribute('name', selector.match(/name="([^"]+)"/)[1]);
      } else if (selector.includes('property=')) {
        element.setAttribute('property', selector.match(/property="([^"]+)"/)[1]);
      }
      document.head.appendChild(element);
    }
    element.setAttribute(attribute, content);
  };

  // Update Description
  if (description) {
    setMetaTag('meta[name="description"]', 'content', description);
    setMetaTag('meta[property="og:description"]', 'content', description);
  }

  // Update Title for Open Graph
  if (title) {
    setMetaTag('meta[property="og:title"]', 'content', title);
  }

  // Update Image for Open Graph
  if (image) {
    setMetaTag('meta[property="og:image"]', 'content', image);
    // Twitter card image
    setMetaTag('meta[name="twitter:image"]', 'content', image);
    setMetaTag('meta[name="twitter:card"]', 'content', 'summary_large_image');
  }

  // Update URL
  if (url) {
    setMetaTag('meta[property="og:url"]', 'content', url);
  }
};
