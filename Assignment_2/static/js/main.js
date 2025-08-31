(function() {
  const animalPreview = document.getElementById('animal-preview');
  const animalCheckboxes = Array.from(document.querySelectorAll('input[name="animal"]'));

  function setExclusiveSelection(chosen) {
    animalCheckboxes.forEach(cb => {
      cb.checked = cb === chosen ? cb.checked : false;
    });
  }

  function updateAnimalPreview() {
    const selected = animalCheckboxes.find(cb => cb.checked);
    if (!selected) {
      animalPreview.innerHTML = '';
      return;
    }
    const name = selected.value;
    const img = document.createElement('img');
    img.alt = name;
    img.src = `/static/images/${name}.jpg`;
    animalPreview.innerHTML = '';
    animalPreview.appendChild(img);
  }

  animalCheckboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      if (e.target.checked) setExclusiveSelection(e.target);
      updateAnimalPreview();
    });
  });

  const form = document.getElementById('upload-form');
  const fileInput = document.getElementById('file-input');
  const result = document.getElementById('upload-result');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      result.textContent = 'Please choose a file first.';
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    result.textContent = 'Uploading...';
    try {
      const res = await fetch('/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      result.textContent = `Name: ${data.name}\nSize (bytes): ${data.size_bytes}\nType: ${data.type}`;
    } catch (err) {
      result.textContent = `Error: ${err.message}`;
    }
  });
})();

