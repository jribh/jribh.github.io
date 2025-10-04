// Grid Guides Toggle
// Press 'G' key to toggle grid visibility

document.addEventListener('DOMContentLoaded', () => {
  const gridGuides = document.querySelector('.grid-guides');
  
  if (!gridGuides) return;
  
  // Toggle grid visibility with 'G' key
  document.addEventListener('keydown', (e) => {
    // Check for 'G' or 'g' key (key code 71)
    if (e.key === 'g' || e.key === 'G') {
      gridGuides.classList.toggle('grid-guides--hidden');
      
      // Optional: Log to console for feedback
      const isHidden = gridGuides.classList.contains('grid-guides--hidden');
      console.log(`Grid guides ${isHidden ? 'hidden' : 'visible'}`);
    }
  });
  
  // Optional: Start with guides visible
  // To start hidden, uncomment the next line:
  // gridGuides.classList.add('grid-guides--hidden');
});
