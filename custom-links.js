// Replaces Access Button Link with Memberstack Custom Value
document.addEventListener("DOMContentLoaded", () => {
  if (!window.$memberstackDom) return;
  
  // Prevent default on all custom link elements
  document.querySelectorAll('[data-ms-custom-link]').forEach(element => {
    if (element.tagName === 'A') {
      element.href = '#';
      element.style.cursor = 'pointer';
    }
  });
  
  document.addEventListener('click', async (e) => {
    const button = e.target.closest('[data-ms-custom-link]');
    if (!button) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Get the field name from the attribute value
    let fieldName = button.dataset.msCustomLink;
    
    if (!fieldName) {
      console.error('No field name specified in data-ms-custom-link');
      return;
    }
    
    // Convert to lowercase to match Memberstack's format
    fieldName = fieldName.toLowerCase();
    
    try {
      const { data: member } = await window.$memberstackDom.getCurrentMember();
      
      if (!member) {
        console.error('No member logged in');
        return;
      }
      
      // Get the custom URL from the specified field
      const customUrl = member.customFields[fieldName];
      
      if (customUrl) {
        // Open in new tab
        window.open(customUrl, '_blank');
      } else {
        console.error(`No URL found in custom field: ${fieldName}`);
        alert(`No link available for this resource`);
      }
      
    } catch (error) {
      console.error('Error getting custom link:', error);
    }
  });
}); 