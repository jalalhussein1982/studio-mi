import { PyStatus } from '../types';

declare global {
  interface Window {
    loadPyodide: any;
    pyodide: any;
  }
}

class PyService {
  private pyodide: any = null;
  private isInitializing: boolean = false;

  async init(onProgress: (status: PyStatus) => void) {
    if (this.pyodide || this.isInitializing) return;
    
    this.isInitializing = true;
    try {
      onProgress({ isReady: false, isLoading: true, message: 'Loading Pyodide Engine...', progress: 10 });
      
      this.pyodide = await window.loadPyodide();
      
      onProgress({ isReady: false, isLoading: true, message: 'Installing micropip...', progress: 30 });
      await this.pyodide.loadPackage("micropip");
      const micropip = this.pyodide.pyimport("micropip");

      onProgress({ isReady: false, isLoading: true, message: 'Installing libraries...', progress: 50 });
      // fpdf2 is not available in default pyodide channel usually, but let's try simple pdf generation with matplotlib backend
      await micropip.install(['pandas', 'numpy', 'scipy', 'scikit-learn', 'statsmodels', 'matplotlib', 'seaborn']);
      
      onProgress({ isReady: false, isLoading: true, message: 'Configuring environment...', progress: 90 });
      
      await this.pyodide.runPythonAsync(`
        import pandas as pd
        import numpy as np
        import scipy.stats as stats
        import matplotlib.pyplot as plt
        from matplotlib.backends.backend_pdf import PdfPages
        import seaborn as sns
        import io
        import base64
        import json
        
        plt.switch_backend('Agg')
        
        df = None
        
        def get_plot_data():
            # PNG
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight', dpi=100)
            buf.seek(0)
            img_str = base64.b64encode(buf.read()).decode('utf-8')
            
            # SVG
            buf_svg = io.BytesIO()
            plt.savefig(buf_svg, format='svg', bbox_inches='tight')
            buf_svg.seek(0)
            svg_str = buf_svg.read().decode('utf-8')
            
            plt.clf()
            plt.close()
            return json.dumps({"png": img_str, "svg": svg_str})
      `);

      onProgress({ isReady: true, isLoading: false, message: 'Ready', progress: 100 });
    } catch (error) {
      console.error("Pyodide Init Error:", error);
      onProgress({ isReady: false, isLoading: false, message: 'Failed to load Python environment.', progress: 0 });
    } finally {
      this.isInitializing = false;
    }
  }

  async loadFile(file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    this.pyodide.FS.writeFile('data.csv', uint8Array);
    
    await this.pyodide.runPythonAsync(`
      try:
          if '${file.name}'.endswith('.xls') or '${file.name}'.endswith('.xlsx'):
              df = pd.read_excel('data.csv')
          else:
              df = pd.read_csv('data.csv')
      except Exception as e:
          raise e
    `);
  }

  async getMetadata(): Promise<any> {
    const result = await this.pyodide.runPythonAsync(`
      summary = []
      for col in df.columns:
          is_num = pd.api.types.is_numeric_dtype(df[col])
          info = {
              "name": col,
              "type": "numeric" if is_num else "object",
              "missing_count": int(df[col].isnull().sum()),
              "count": int(df[col].count())
          }
          if is_num:
              info.update({
                  "mean": float(df[col].mean()) if not df[col].isnull().all() else None,
                  "std": float(df[col].std()) if not df[col].isnull().all() else None,
                  "min": float(df[col].min()) if not df[col].isnull().all() else None,
                  "max": float(df[col].max()) if not df[col].isnull().all() else None,
                  "median": float(df[col].median()) if not df[col].isnull().all() else None
              })
          summary.append(info)

      json.dumps({
          "rows": len(df),
          "cols": len(df.columns),
          "columns": df.columns.tolist(),
          "summary": summary
      })
    `);
    return JSON.parse(result);
  }

  async keepColumns(columns: string[]) {
    const colStr = JSON.stringify(columns);
    await this.pyodide.runPythonAsync(`
      cols = ${colStr}
      df = df[cols]
    `);
  }

  async getMissingRows() {
      const result = await this.pyodide.runPythonAsync(`
        issues = []
        # Check for missing
        rows_with_nan = df[df.isnull().any(axis=1)]
        for idx, row in rows_with_nan.iterrows():
            for col in df.columns:
                if pd.isnull(row[col]):
                    issues.append({
                        "row": int(idx),
                        "column": col,
                        "value": None,
                        "issue": "missing"
                    })
        json.dumps(issues)
      `);
      return JSON.parse(result);
  }

  async cleanData(action: string, targetCols: string[] = []) {
    const colsStr = JSON.stringify(targetCols);
    await this.pyodide.runPythonAsync(`
      action = '${action}'
      targets = ${colsStr}
      
      if action == 'delete':
          df.dropna(inplace=True)
          df.reset_index(drop=True, inplace=True)
      elif action == 'impute_mean':
          for col in targets:
              if pd.api.types.is_numeric_dtype(df[col]):
                  df[col].fillna(df[col].mean(), inplace=True)
      elif action == 'impute_median':
          for col in targets:
              if pd.api.types.is_numeric_dtype(df[col]):
                  df[col].fillna(df[col].median(), inplace=True)
      elif action == 'impute_mode':
          for col in targets:
               mode_val = df[col].mode()
               if not mode_val.empty:
                   df[col].fillna(mode_val[0], inplace=True)
    `);
  }

  async updateCell(rowIdx: number, col: string, value: string) {
    await this.pyodide.runPythonAsync(`
        try:
            val = float('${value}')
            df.at[${rowIdx}, '${col}'] = val
        except:
            pass
    `);
  }

  async detectOutliers(method: string) {
    const res = await this.pyodide.runPythonAsync(`
      outliers = {}
      numeric_cols = df.select_dtypes(include=[np.number]).columns
      
      for col in numeric_cols:
          data = df[col].dropna()
          indices = []
          if '${method}' == 'IQR':
              Q1 = data.quantile(0.25)
              Q3 = data.quantile(0.75)
              IQR = Q3 - Q1
              indices = data[(data < (Q1 - 1.5 * IQR)) | (data > (Q3 + 1.5 * IQR))].index.tolist()
          elif '${method}' == 'Z_SCORE':
              z = np.abs(stats.zscore(data))
              indices = data[z > 3].index.tolist()
          elif '${method}' == 'MODIFIED_Z':
              median = np.median(data)
              mad = np.median(np.abs(data - median))
              if mad != 0:
                  modified_z = 0.6745 * (data - median) / mad
                  indices = data[np.abs(modified_z) > 3.5].index.tolist()
          
          if len(indices) > 0:
              outliers[col] = {
                  "count": len(indices),
                  "indices": indices,
                  "values": df.loc[indices, col].tolist()
              }
      
      json.dumps(outliers)
    `);
    return JSON.parse(res);
  }

  async handleOutliers(col: string, action: string, method: string) {
     await this.pyodide.runPythonAsync(`
        col = '${col}'
        action = '${action}'
        
        data = df[col].dropna()
        indices = []
        
        # Re-detect indices to be safe
        if '${method}' == 'IQR':
            Q1 = data.quantile(0.25)
            Q3 = data.quantile(0.75)
            IQR = Q3 - Q1
            lower = Q1 - 1.5 * IQR
            upper = Q3 + 1.5 * IQR
            indices = data[(data < lower) | (data > upper)].index.tolist()
        elif '${method}' == 'Z_SCORE':
            z = np.abs(stats.zscore(data))
            indices = data[z > 3].index.tolist()
        elif '${method}' == 'MODIFIED_Z':
            median = np.median(data)
            mad = np.median(np.abs(data - median))
            if mad != 0:
                modified_z = 0.6745 * (data - median) / mad
                indices = data[np.abs(modified_z) > 3.5].index.tolist()

        if action == 'delete':
            df.drop(indices, inplace=True)
            df.reset_index(drop=True, inplace=True)
        
        elif action == 'winsorize':
             if '${method}' == 'IQR':
                 df[col] = df[col].clip(lower=lower, upper=upper)
             # For others, simplistic winsorization at min/max of non-outliers
             else:
                 non_outliers = df.drop(indices)[col]
                 min_v, max_v = non_outliers.min(), non_outliers.max()
                 df[col] = df[col].clip(lower=min_v, upper=max_v)
                 
        elif action == 'impute_mean':
            mean_val = df.drop(indices)[col].mean()
            df.loc[indices, col] = mean_val
            
        elif action == 'impute_median':
            med_val = df.drop(indices)[col].median()
            df.loc[indices, col] = med_val
            
        elif action == 'log':
            min_val = df[col].min()
            shift = abs(min_val) + 1 if min_val <= 0 else 0
            df[col] = np.log(df[col] + shift)
            
        elif action == 'sqrt':
             min_val = df[col].min()
             if min_val < 0:
                 # Sqrt not defined for negative, shift
                 df[col] = np.sqrt(df[col] + abs(min_val))
             else:
                 df[col] = np.sqrt(df[col])
     `);
  }

  async generateUnivariatePlots(col: string, dist: string = 'norm') {
    const res = await this.pyodide.runPythonAsync(`
      col = '${col}'
      dist = '${dist}'
      result = {}
      
      # KDE
      plt.figure(figsize=(6, 4))
      sns.kdeplot(data=df, x=col, fill=True)
      plt.title(f'KDE Plot: {col}')
      result['kde'] = get_plot_data()
      
      # Box
      plt.figure(figsize=(6, 4))
      sns.boxplot(x=df[col])
      plt.title(f'Box Plot: {col}')
      result['box'] = get_plot_data()
      
      # QQ
      plt.figure(figsize=(6, 4))
      if dist == 'norm':
          stats.probplot(df[col].dropna(), dist="norm", plot=plt)
      elif dist == 't':
          stats.probplot(df[col].dropna(), dist=stats.t, sparams=(10,), plot=plt)
      elif dist == 'uniform':
          stats.probplot(df[col].dropna(), dist="uniform", plot=plt)
      
      plt.title(f'Q-Q Plot: {col} ({dist})')
      result['qq'] = get_plot_data()
      
      json.dumps(result)
    `);
    return JSON.parse(res);
  }

  async generateScatter(x: string, y: string, showLine: boolean, showLowess: boolean, polyDegree: number | null) {
      const res = await this.pyodide.runPythonAsync(`
        x = '${x}'
        y = '${y}'
        show_line = ${showLine ? 'True' : 'False'}
        show_lowess = ${showLowess ? 'True' : 'False'}
        poly_degree = ${polyDegree !== null ? polyDegree : 'None'}
        
        plt.figure(figsize=(8, 6))
        sns.scatterplot(data=df, x=x, y=y, alpha=0.6)
        
        if show_line:
            sns.regplot(data=df, x=x, y=y, scatter=False, color='red', label='Linear Fit')
        if show_lowess:
             sns.regplot(data=df, x=x, y=y, scatter=False, lowess=True, color='green', label='LOWESS')
        if poly_degree is not None:
             sns.regplot(data=df, x=x, y=y, scatter=False, order=poly_degree, color='orange', label=f'Poly Order {poly_degree}')
        
        if show_line or show_lowess or poly_degree:
            plt.legend()
            
        plt.title(f'{y} vs {x}')
        get_plot_data()
      `);
      return JSON.parse(res);
  }

  async calcCorrelations(dv: string, ivs: string[]) {
      const ivsStr = JSON.stringify(ivs);
      const res = await this.pyodide.runPythonAsync(`
        dv = '${dv}'
        ivs = ${ivsStr}
        methods = ['pearson', 'spearman', 'kendall']
        results = {}
        
        for method in methods:
            plt.figure(figsize=(8, 6))
            corr_matrix = df[[dv] + ivs].corr(method=method)
            sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', vmin=-1, vmax=1)
            plt.title(f'{method.capitalize()} Correlation Heatmap')
            results[f'heatmap_{method}'] = get_plot_data()
            
        table_data = []
        for iv in ivs:
            row = {'variable': iv}
            
            # Pearson
            clean_p = df[[dv, iv]].dropna()
            if len(clean_p) > 2:
                r, p = stats.pearsonr(clean_p[dv], clean_p[iv])
                z = np.arctanh(min(max(r, -0.999), 0.999))
                sigma = 1/np.sqrt(len(clean_p) - 3)
                cint = z + np.array([-1, 1]) * sigma * 1.96
                lower, upper = np.tanh(cint)
                row['pearson'] = {'r': r, 'p': p, 'n': len(clean_p), 'ci': [lower, upper]}
            else:
                row['pearson'] = {'r': 0, 'p': 1, 'n': len(clean_p), 'ci': [0,0]}
            
            # Spearman
            clean_s = df[[dv, iv]].dropna()
            if len(clean_s) > 2:
                sr, sp = stats.spearmanr(clean_s[dv], clean_s[iv])
                row['spearman'] = {'r': sr, 'p': sp, 'n': len(clean_s)}
            else:
                row['spearman'] = {'r': 0, 'p': 1}
            
            # Kendall
            clean_k = df[[dv, iv]].dropna()
            if len(clean_k) > 2:
                kr, kp = stats.kendalltau(clean_k[dv], clean_k[iv])
                row['kendall'] = {'r': kr, 'p': kp, 'n': len(clean_k)}
            else:
                row['kendall'] = {'r': 0, 'p': 1}
                
            table_data.append(row)
            
        results['table'] = table_data
        json.dumps(results)
      `);
      return JSON.parse(res);
  }
  
  async downloadCorrelationPDF(dv: string, ivs: string[]) {
      const ivsStr = JSON.stringify(ivs);
      await this.pyodide.runPythonAsync(`
        dv = '${dv}'
        ivs = ${ivsStr}
        
        pdf_buffer = io.BytesIO()
        with PdfPages(pdf_buffer) as pdf:
            # 1. Summary Text Page
            plt.figure(figsize=(11, 8.5))
            plt.axis('off')
            plt.text(0.5, 0.9, "Correlation Analysis Report", ha='center', fontsize=24)
            plt.text(0.1, 0.8, f"Dependent Variable: {dv}", fontsize=14)
            plt.text(0.1, 0.75, f"Independent Variables: {', '.join(ivs)}", fontsize=12, wrap=True)
            pdf.savefig()
            plt.close()

            # 2. Heatmaps
            methods = ['pearson', 'spearman', 'kendall']
            for method in methods:
                plt.figure(figsize=(10, 8))
                corr_matrix = df[[dv] + ivs].corr(method=method)
                sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', vmin=-1, vmax=1)
                plt.title(f'{method.capitalize()} Correlation Heatmap')
                pdf.savefig()
                plt.close()
        
        # Convert to Base64 to download in JS
        pdf_buffer.seek(0)
        pdf_b64 = base64.b64encode(pdf_buffer.read()).decode('utf-8')
      `);
      
      const b64 = this.pyodide.globals.get('pdf_b64');
      // Create link and download
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${b64}`;
      link.download = 'correlation_analysis.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }
}

export const pyService = new PyService();
