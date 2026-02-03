// Storage Module - Handle image uploads

const Storage = {
    // Upload image for a choice option
    async uploadChoiceImage(file, fieldCode, choiceCode) {
        // Validate file
        if (!file) {
            throw new Error('No file provided');
        }

        // Check file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
        }

        // Check file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error('File too large. Maximum size is 5MB.');
        }

        // Generate unique filename
        const ext = file.name.split('.').pop().toLowerCase();
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const fileName = `${fieldCode}/${choiceCode}_${timestamp}_${random}.${ext}`;

        // Upload to Supabase Storage
        const { data, error } = await db.storage
            .from('choice-images')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Upload error:', error);
            throw new Error('Failed to upload image');
        }

        // Get public URL
        const { data: { publicUrl } } = db.storage
            .from('choice-images')
            .getPublicUrl(fileName);

        return publicUrl;
    },

    // Delete an image
    async deleteChoiceImage(imageUrl) {
        if (!imageUrl) return;

        try {
            // Extract path from URL
            const urlParts = imageUrl.split('/choice-images/');
            if (urlParts.length < 2) return;

            const path = urlParts[1];

            const { error } = await db.storage
                .from('choice-images')
                .remove([path]);

            if (error) {
                console.error('Delete error:', error);
            }
        } catch (err) {
            console.error('Failed to delete image:', err);
        }
    },

    // Create image preview from file
    createPreview(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
        });
    }
};
