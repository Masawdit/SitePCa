// Nextcloud Integration Module

const Nextcloud = {
    // Upload file to Nextcloud via Supabase Edge Function
    async uploadFile(formSettings, fileName, fileContent, contentType) {
        if (!formSettings.nextcloud_enabled) {
            throw new Error('Nextcloud non configuré pour ce formulaire');
        }

        const response = await fetch(`${SUPABASE_URL}/functions/v1/upload-to-nextcloud`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                nextcloudUrl: formSettings.nextcloud_url,
                username: formSettings.nextcloud_username,
                password: formSettings.nextcloud_password,
                folderPath: formSettings.nextcloud_folder || '/FormResponses',
                fileName: fileName,
                fileContent: fileContent,  // Base64
                contentType: contentType
            })
        });

        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(result.error || 'Échec de l\'envoi vers Nextcloud');
        }

        return result;
    },

    // Upload both PDF and CSV
    async uploadFormResponse(formSettings, pdfDoc, csvContent, formTitle, timestamp) {
        const safeTitle = (formTitle || 'formulaire').replace(/[^a-z0-9]/gi, '_');
        const dateStr = timestamp.replace(/[/:]/g, '-').replace(/ /g, '_');

        const results = { pdf: null, csv: null, errors: [] };

        // Upload PDF
        try {
            const pdfBlob = pdfDoc.output('blob');
            const pdfBase64 = await this.blobToBase64(pdfBlob);
            results.pdf = await this.uploadFile(
                formSettings,
                `${safeTitle}_${dateStr}.pdf`,
                pdfBase64,
                'application/pdf'
            );
        } catch (err) {
            results.errors.push(`PDF: ${err.message}`);
        }

        // Upload CSV
        try {
            const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));
            results.csv = await this.uploadFile(
                formSettings,
                `${safeTitle}_${dateStr}.csv`,
                csvBase64,
                'text/csv;charset=utf-8'
            );
        } catch (err) {
            results.errors.push(`CSV: ${err.message}`);
        }

        return results;
    },

    // Helper: Convert Blob to Base64
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
};
