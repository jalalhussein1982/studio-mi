# PyStat: Client-Side Statistical Analysis

A secure, browser-based statistical analysis tool using Pyodide to process data locally. Features comprehensive data cleaning, outlier detection, and advanced visualization.

## Overview

PyStat is a privacy-focused statistical analysis application that runs entirely in your browser. All data processing happens locally using Pyodide (Python in WebAssembly), ensuring your sensitive data never leaves your device.

## Features

### Data Security
- **100% Client-Side Processing**: All computations run in your browser using Pyodide
- **No Server Uploads**: Your data stays on your device
- **Privacy First**: No data collection or external API calls

### Analysis Capabilities

#### 1. Data Upload & Import
- Support for CSV and Excel files (.csv, .xls, .xlsx)
- File size limit: 50 MB
- Automatic data type detection

#### 2. Variable Selection
- Select Dependent Variable (DV) - target variable for analysis
- Select multiple Independent Variables (IVs) - predictor variables
- Automatic filtering to numeric variables

#### 3. Data Quality Check
- **Missing Value Detection**: Identifies all missing/null values
- **Cleaning Options**:
  - Delete rows with missing values
  - Impute with mean, median, or mode
  - Manual editing of individual cells
- Real-time issue tracking and reporting

#### 4. Outlier Detection & Treatment
Multiple detection methods:
- **IQR Method**: Interquartile range-based detection
- **Z-Score**: Standard deviation-based detection
- **Modified Z-Score**: Median absolute deviation-based detection

Treatment options:
- Ignore outliers
- Delete rows containing outliers
- Winsorization (capping at boundaries)
- Imputation (mean or median)
- Transformations (log or square root)

#### 5. Univariate Analysis
For each variable, generates:
- **KDE Plot**: Kernel Density Estimation for distribution visualization
- **Box Plot**: Five-number summary with outlier detection
- **Q-Q Plot**: Quantile-Quantile plot for normality assessment
  - Support for Normal, t-distribution, and Uniform distributions

#### 6. Bivariate Analysis
Interactive scatter plots with:
- Raw data points
- Linear regression line
- LOWESS (Locally Weighted Scatterplot Smoothing)
- Polynomial regression (degrees 2-4)
- Easy navigation between IV pairs

#### 7. Correlation Analysis
Comprehensive correlation testing:
- **Pearson Correlation**: Linear relationship strength
- **Spearman Correlation**: Monotonic relationship strength
- **Kendall's Tau**: Ordinal association strength

Includes:
- Correlation coefficients
- p-values for significance testing
- 95% Confidence intervals (for Pearson)
- Interactive heatmap visualizations
- PDF report generation

### Visualization Features
- High-quality plots (PNG and SVG formats)
- Download individual plots
- Maximize plots for detailed inspection
- Interactive plot customization
- Professional styling with seaborn

## Technology Stack

### Frontend
- **React 19.2.0** with TypeScript
- **Vite** for fast development and building
- **TailwindCSS** for styling
- **Lucide React** for icons

### Python Environment (Pyodide)
- **Pandas**: Data manipulation and analysis
- **NumPy**: Numerical computing
- **SciPy**: Statistical functions
- **Scikit-learn**: Machine learning utilities
- **Statsmodels**: Advanced statistical tests
- **Matplotlib**: Plotting and visualization
- **Seaborn**: Statistical data visualization

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd studio-mi
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

5. Preview production build:
```bash
npm run preview
```

## Usage

### Basic Workflow

1. **Launch the Application**
   - Open the app in your browser
   - Wait for Pyodide to initialize (first load may take a moment)

2. **Upload Data**
   - Drag and drop a CSV/Excel file or click to browse
   - Maximum file size: 50 MB

3. **Select Variables**
   - Choose one Dependent Variable (target)
   - Choose one or more Independent Variables (features)
   - Click "Start Analysis"

4. **Handle Data Quality Issues**
   - Review detected missing values
   - Choose cleaning strategy:
     - Delete problematic rows
     - Impute with statistical measures
     - Fix values manually

5. **Manage Outliers**
   - Review outliers detected for each variable
   - Select detection method (IQR, Z-Score, Modified Z)
   - Apply treatment method per variable

6. **Explore Distributions**
   - View univariate plots for each variable
   - Assess normality using Q-Q plots
   - Examine distribution shape with KDE plots

7. **Analyze Relationships**
   - Create scatter plots for each DV-IV pair
   - Fit regression lines and curves
   - Assess linearity and patterns

8. **Review Correlations**
   - Examine correlation matrices
   - Check statistical significance
   - Download comprehensive PDF report

## File Structure

```
studio-mi/
├── components/
│   └── LoadingOverlay.tsx      # Loading state UI component
├── services/
│   └── pyService.ts             # Pyodide wrapper and Python execution
├── App.tsx                      # Main application component
├── index.tsx                    # Application entry point
├── types.ts                     # TypeScript type definitions
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript configuration
├── package.json                 # Dependencies and scripts
├── index.html                   # HTML template
└── metadata.json                # Application metadata
```

## Key Components

### App.tsx
Main application component managing:
- Application state and step progression
- File upload and data processing
- User interactions and event handlers
- Multi-step workflow orchestration

### pyService.ts
Python/Pyodide service layer providing:
- Pyodide initialization and package management
- Data loading and manipulation
- Statistical computations
- Plot generation
- PDF report creation

### types.ts
TypeScript interfaces and enums for:
- Application state management
- Data structures
- Analysis configurations
- Type safety throughout the app

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Modern browsers with WebAssembly support

**Note**: First load requires downloading Pyodide and packages (~50-100 MB). Subsequent loads are faster due to browser caching.

## Performance Considerations

- **Large Datasets**: Processing time increases with dataset size. Recommended maximum: 100,000 rows
- **Memory**: Ensure sufficient browser memory for large datasets
- **First Load**: Initial Pyodide setup takes 30-60 seconds
- **Subsequent Operations**: Most operations complete in 1-5 seconds

## Limitations

- Maximum file size: 50 MB
- Numeric variables only for analysis
- Browser memory constraints apply
- No support for categorical regression (yet)
- No time series analysis capabilities

## Development

### Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Adding New Analysis Features

1. Add Python code in `pyService.ts` methods
2. Update TypeScript types in `types.ts`
3. Add UI components in `App.tsx`
4. Update workflow steps as needed

## Troubleshooting

### Pyodide fails to load
- Check internet connection (required for first load)
- Clear browser cache and reload
- Try a different browser

### File upload fails
- Ensure file is valid CSV or Excel format
- Check file size is under 50 MB
- Verify file contains numeric columns

### Plots not rendering
- Wait for processing to complete
- Check browser console for errors
- Ensure data has valid numeric values

## Future Enhancements

- Support for categorical variables
- ANOVA and t-tests
- Multiple regression analysis
- Time series analysis
- Custom plot themes
- Export data after cleaning
- Offline PWA support

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License

Copyright (c) 2025 Jalal Hussein

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Author

**Jalal Hussein**
- Email: jalalhussein@gmail.com
- GitHub: [@JalalHussein](https://github.com/jalalhussein1982)

## Acknowledgments

- Built with [Pyodide](https://pyodide.org/)
- UI components styled with [TailwindCSS](https://tailwindcss.com/)
- Icons from [Lucide](https://lucide.dev/)
- Statistical computing powered by the Python scientific stack

## Support

For issues, questions, or contributions, please:
- Open an issue on the repository
- Contact: jalalhussein@gmail.com

---

**Made with care for data privacy and statistical rigor by Jalal Hussein.**
