// PDF Export Module

const PDFExport = {
    // Generate and download PDF from response data
    generatePDF(responseData, fields, formTitle) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);
        let yPosition = margin;

        // Title
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(formTitle || 'Formulaire', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10;

        // Submission date
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        const dateStr = `Soumis le : ${new Date().toLocaleString('fr-FR')}`;
        doc.text(dateStr, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;

        // Reset text color
        doc.setTextColor(0, 0, 0);

        // Horizontal line
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 10;

        // Fields and responses
        doc.setFontSize(11);

        fields.forEach((field, index) => {
            const response = responseData[field.code];
            if (!response) return;

            // Check if we need a new page
            if (yPosition > 270) {
                doc.addPage();
                yPosition = margin;
            }

            // Field label
            doc.setFont('helvetica', 'bold');
            doc.text(response.label + ' :', margin, yPosition);
            yPosition += 6;

            // Field value
            doc.setFont('helvetica', 'normal');
            let value = this.formatValue(response.value, field, response.additionalInputs);

            // Handle long text with word wrap
            const lines = doc.splitTextToSize(value, contentWidth);
            lines.forEach(line => {
                if (yPosition > 280) {
                    doc.addPage();
                    yPosition = margin;
                }
                doc.text(line, margin, yPosition);
                yPosition += 5;
            });

            yPosition += 5;

            // Light separator between fields
            if (index < fields.length - 1) {
                doc.setDrawColor(230, 230, 230);
                doc.line(margin, yPosition, pageWidth - margin, yPosition);
                yPosition += 8;
            }
        });

        // Footer
        yPosition += 10;
        if (yPosition > 280) {
            doc.addPage();
            yPosition = margin;
        }
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Document PDF', pageWidth / 2, 290, { align: 'center' });

        return doc;
    },

    // Format value based on field type
    formatValue(value, field, additionalInputs = null) {
        if (value === null || value === undefined) {
            return '';
        }

        const extras = additionalInputs || {};

        // Handle arrays (checkboxes)
        if (Array.isArray(value)) {
            if (field.choices && field.choices.length > 0) {
                return value.map(code => {
                    const choice = field.choices.find(c => c.code === code);
                    let label = choice ? choice.label : code;
                    // Append additional input if exists
                    if (extras[code]) {
                        label += `: ${extras[code]}`;
                    }
                    return label;
                }).join(', ');
            }
            return value.join(', ');
        }

        // Handle multiple choice / dropdown - convert code to label
        if ((field.field_type === 'multiple_choice' || field.field_type === 'dropdown') && field.choices) {
            const choice = field.choices.find(c => c.code === value);
            if (choice) {
                let label = choice.label;
                // Append additional input if exists
                if (extras[value]) {
                    label += `: ${extras[value]}`;
                }
                return label;
            }
        }

        // Handle rating
        if (field.field_type === 'rating') {
            return `${value} / ${field.settings?.max || 5}`;
        }

        return String(value);
    },

    // Download the PDF
    downloadPDF(responseData, fields, formTitle) {
        const doc = this.generatePDF(responseData, fields, formTitle);
        const filename = `${(formTitle || 'formulaire').replace(/[^a-z0-9]/gi, '_')}_reponse.pdf`;
        doc.save(filename);
    }
};
