// CSV Export Module

const Export = {
    // Generate CSV from response data
    generateCSV(responseData, fields) {
        const rows = [];

        // Header row
        rows.push(['Field Code', 'Field Label', 'Response']);

        // Data rows
        fields.forEach(field => {
            const response = responseData[field.code];
            if (response) {
                let value = response.value;

                // Handle arrays (checkboxes)
                if (Array.isArray(value)) {
                    // Convert choice codes to labels if possible
                    if (field.choices && field.choices.length > 0) {
                        value = value.map(code => {
                            const choice = field.choices.find(c => c.code === code);
                            return choice ? choice.label : code;
                        }).join('; ');
                    } else {
                        value = value.join('; ');
                    }
                } else if (field.field_type === 'multiple_choice' || field.field_type === 'dropdown') {
                    // Convert choice code to label
                    if (field.choices && field.choices.length > 0) {
                        const choice = field.choices.find(c => c.code === value);
                        if (choice) {
                            value = choice.label;
                        }
                    }
                }

                rows.push([field.code, response.label, value]);
            }
        });

        // Convert to CSV string
        return rows.map(row =>
            row.map(cell => {
                // Escape quotes and wrap in quotes
                const escaped = String(cell).replace(/"/g, '""');
                return `"${escaped}"`;
            }).join(',')
        ).join('\n');
    },

    // Generate CSV from form element (alternative method)
    generateCSVFromForm(formElement, fields) {
        const formData = new FormData(formElement);
        const rows = [];

        // Header row
        rows.push(['Field Code', 'Field Label', 'Response']);

        // Data rows
        fields.forEach(field => {
            let value = '';

            if (field.field_type === 'checkbox') {
                // Multiple values
                const values = formData.getAll(field.code);
                if (field.choices && field.choices.length > 0) {
                    value = values.map(code => {
                        const choice = field.choices.find(c => c.code === code);
                        return choice ? choice.label : code;
                    }).join('; ');
                } else {
                    value = values.join('; ');
                }
            } else if (field.field_type === 'multiple_choice' || field.field_type === 'dropdown') {
                const rawValue = formData.get(field.code) || '';
                if (field.choices && field.choices.length > 0) {
                    const choice = field.choices.find(c => c.code === rawValue);
                    value = choice ? choice.label : rawValue;
                } else {
                    value = rawValue;
                }
            } else if (field.field_type === 'file') {
                const file = formData.get(field.code);
                value = file ? file.name : '';
            } else {
                value = formData.get(field.code) || '';
            }

            rows.push([field.code, field.label, value]);
        });

        // Convert to CSV string
        return rows.map(row =>
            row.map(cell => {
                const escaped = String(cell).replace(/"/g, '""');
                return `"${escaped}"`;
            }).join(',')
        ).join('\n');
    },

    // Download CSV as file
    downloadCSV(csvContent, filename) {
        // Add BOM for Excel UTF-8 compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.href = url;
        link.download = filename || 'form_response.csv';
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    // Open mailto with CSV data
    mailtoCSV(csvContent, formTitle, recipientEmail = '') {
        const subject = encodeURIComponent(`Form Response: ${formTitle}`);

        // Convert CSV to readable text for email body
        const lines = csvContent.split('\n');
        let bodyText = `Form Response: ${formTitle}\n`;
        bodyText += `Submitted: ${new Date().toLocaleString()}\n\n`;
        bodyText += '---\n\n';

        // Skip header row, format data nicely
        for (let i = 1; i < lines.length; i++) {
            // Parse CSV line
            const matches = lines[i].match(/"([^"]*)"/g);
            if (matches && matches.length >= 3) {
                const label = matches[1].replace(/"/g, '');
                const value = matches[2].replace(/"/g, '');
                bodyText += `${label}: ${value}\n`;
            }
        }

        bodyText += '\n---\n';
        bodyText += 'Generated by Form Builder';

        const body = encodeURIComponent(bodyText);
        window.location.href = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
    },

    // Generate download for admin (all responses)
    async generateAllResponsesCSV(formId, fields) {
        try {
            const { data: responses, error } = await db
                .from('responses')
                .select('*')
                .eq('form_id', formId)
                .order('submitted_at', { ascending: false });

            if (error) throw error;

            if (!responses || responses.length === 0) {
                return null;
            }

            const rows = [];

            // Header row - includes submission date
            const header = ['Submission Date', ...fields.map(f => f.label)];
            rows.push(header);

            // Data rows
            responses.forEach(response => {
                const row = [new Date(response.submitted_at).toLocaleString()];

                fields.forEach(field => {
                    const fieldResponse = response.response_data[field.code];
                    let value = '';

                    if (fieldResponse) {
                        value = fieldResponse.value;

                        // Handle arrays
                        if (Array.isArray(value)) {
                            if (field.choices && field.choices.length > 0) {
                                value = value.map(code => {
                                    const choice = field.choices.find(c => c.code === code);
                                    return choice ? choice.label : code;
                                }).join('; ');
                            } else {
                                value = value.join('; ');
                            }
                        } else if ((field.field_type === 'multiple_choice' || field.field_type === 'dropdown') && field.choices) {
                            const choice = field.choices.find(c => c.code === value);
                            if (choice) {
                                value = choice.label;
                            }
                        }
                    }

                    row.push(value);
                });

                rows.push(row);
            });

            // Convert to CSV
            return rows.map(row =>
                row.map(cell => {
                    const escaped = String(cell).replace(/"/g, '""');
                    return `"${escaped}"`;
                }).join(',')
            ).join('\n');

        } catch (err) {
            console.error('Error generating responses CSV:', err);
            throw err;
        }
    }
};
