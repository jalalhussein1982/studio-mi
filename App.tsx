import React, { useEffect, useState, useCallback } from 'react';
import { 
    AppStep, PyStatus, DatasetMetadata, DataIssue, OutlierMethod, OutlierAction, PlotResult 
} from './types';
import { pyService } from './services/pyService';
import { LoadingOverlay } from './components/LoadingOverlay';
import {
  ArrowRight, Upload, AlertCircle, BarChart2, Activity, Trash2, Edit2, 
  Eye, Download, ChevronRight, ChevronLeft, FileText, Maximize2, CheckCircle, XCircle
} from 'lucide-react';

const MAX_FILE_SIZE_MB = 50;

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.INITIALIZATION);
  const [pyStatus, setPyStatus] = useState<PyStatus>({ isReady: false, isLoading: true, message: 'Initializing...', progress: 0 });
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<DatasetMetadata | null>(null);
  
  // Variable Selection
  const [selectedDV, setSelectedDV] = useState<string>('');
  const [selectedIVs, setSelectedIVs] = useState<string[]>([]);

  // Step 3: Quality
  const [issues, setIssues] = useState<DataIssue[]>([]);
  const [imputeTargetVars, setImputeTargetVars] = useState<string[]>([]);
  const [manualEditIssue, setManualEditIssue] = useState<DataIssue | null>(null);
  const [manualEditValue, setManualEditValue] = useState<string>('');

  // Step 4: Outliers
  const [outlierMethod, setOutlierMethod] = useState<OutlierMethod>(OutlierMethod.IQR);
  const [outliers, setOutliers] = useState<Record<string, any>>({});
  
  // Step 5: Univariate
  const [uniPlots, setUniPlots] = useState<Record<string, Record<string, PlotResult>>>({});
  const [activeUniVar, setActiveUniVar] = useState<string>('');
  const [qqDist, setQqDist] = useState<string>('norm');
  
  // Step 6: Bivariate
  const [scatterImg, setScatterImg] = useState<PlotResult | null>(null);
  const [activeBivariateIVIndex, setActiveBivariateIVIndex] = useState<number>(0);
  const [scatterOpts, setScatterOpts] = useState({ line: true, lowess: false, poly: null as number | null });
  
  // Step 7: Correlations
  const [corrData, setCorrData] = useState<any>(null);
  const [showCorrTable, setShowCorrTable] = useState(true);

  // Modals
  const [maximizedImg, setMaximizedImg] = useState<string | null>(null);

  // Initial Load
  useEffect(() => {
    pyService.init((status) => {
      setPyStatus(status);
      if (status.isReady) {
        setCurrentStep(AppStep.DATA_UPLOAD);
      }
    });
  }, []);

  // --- Handlers ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      return;
    }

    setPyStatus({ ...pyStatus, isLoading: true, message: 'Uploading & Parsing...' });
    setError(null);
    try {
      await pyService.loadFile(file);
      const meta = await pyService.getMetadata();
      setMetadata(meta);
      setCurrentStep(AppStep.VARIABLE_SELECTION);
    } catch (err: any) {
      setError("Failed to load file. Ensure it is a valid CSV/Excel file.");
    } finally {
      setPyStatus(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleVariableSubmit = async () => {
    if (!selectedDV || selectedIVs.length === 0) {
      setError("Please select 1 Dependent Variable and at least 1 Independent Variable.");
      return;
    }
    setError(null);
    setPyStatus({ ...pyStatus, isLoading: true, message: 'Filtering dataset...' });
    
    try {
      await pyService.keepColumns([selectedDV, ...selectedIVs]);
      const newIssues = await pyService.getMissingRows();
      setIssues(newIssues);
      setImputeTargetVars([selectedDV, ...selectedIVs]); // Default all checked for impute
      setCurrentStep(AppStep.DATA_QUALITY);
    } catch (e) {
      setError("Error processing variables.");
    } finally {
      setPyStatus(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleQualityAction = async (action: 'delete' | 'impute_mean' | 'impute_median' | 'impute_mode') => {
      setPyStatus({ ...pyStatus, isLoading: true, message: 'Cleaning data...' });
      try {
          await pyService.cleanData(action, imputeTargetVars);
          const out = await pyService.detectOutliers(outlierMethod);
          setOutliers(out);
          setCurrentStep(AppStep.OUTLIER_DETECTION);
      } catch(e) {
          setError("Data cleaning failed.");
      } finally {
          setPyStatus(prev => ({ ...prev, isLoading: false }));
      }
  };

  const handleManualEditSubmit = async () => {
      if (!manualEditIssue) return;
      setPyStatus({ ...pyStatus, isLoading: true, message: 'Updating value...' });
      try {
          await pyService.updateCell(manualEditIssue.row, manualEditIssue.column, manualEditValue);
          const newIssues = await pyService.getMissingRows();
          setIssues(newIssues);
          setManualEditIssue(null);
          setManualEditValue('');
      } finally {
          setPyStatus(prev => ({ ...prev, isLoading: false }));
      }
  };

  const handleOutlierMethodChange = async (method: OutlierMethod) => {
      setOutlierMethod(method);
      setPyStatus({ ...pyStatus, isLoading: true, message: 'Re-detecting outliers...' });
      try {
          const out = await pyService.detectOutliers(method);
          setOutliers(out);
      } finally {
          setPyStatus(prev => ({ ...prev, isLoading: false }));
      }
  };

  const handleOutlierAction = async (col: string, action: OutlierAction) => {
      setPyStatus({ ...pyStatus, isLoading: true, message: `Applying ${action} to ${col}...` });
      try {
          await pyService.handleOutliers(col, action, outlierMethod);
          const out = await pyService.detectOutliers(outlierMethod);
          setOutliers(out);
      } finally {
          setPyStatus(prev => ({ ...prev, isLoading: false }));
      }
  };

  const generateUniPlot = async (col: string, dist: string) => {
      setPyStatus({ ...pyStatus, isLoading: true, message: `Generating plots for ${col}...` });
      try {
        const plots = await pyService.generateUnivariatePlots(col, dist);
        setUniPlots(prev => ({ ...prev, [col]: plots }));
      } finally {
        setPyStatus(prev => ({ ...prev, isLoading: false }));
      }
  };

  const updateScatter = useCallback(async () => {
      if (selectedIVs.length === 0) return;
      const x = selectedIVs[activeBivariateIVIndex];
      const y = selectedDV;
      setPyStatus({ ...pyStatus, isLoading: true, message: 'Rendering Scatter...' });
      try {
          const img = await pyService.generateScatter(x, y, scatterOpts.line, scatterOpts.lowess, scatterOpts.poly);
          setScatterImg(img);
      } finally {
          setPyStatus(prev => ({ ...prev, isLoading: false }));
      }
  }, [activeBivariateIVIndex, selectedDV, selectedIVs, scatterOpts, pyStatus]);

  const handleCalcCorrelations = async () => {
      setPyStatus({ ...pyStatus, isLoading: true, message: 'Calculating Correlations...' });
      try {
          const res = await pyService.calcCorrelations(selectedDV, selectedIVs);
          setCorrData(res);
          setCurrentStep(AppStep.CORRELATION_ANALYSIS);
      } finally {
          setPyStatus(prev => ({ ...prev, isLoading: false }));
      }
  };

  const downloadImage = (plotResult: PlotResult, filename: string) => {
      // Trigger download for PNG
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${plotResult.png}`;
      link.download = `${filename}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Trigger download for SVG
      const blob = new Blob([plotResult.svg], {type: 'image/svg+xml'});
      const url = URL.createObjectURL(blob);
      const linkSvg = document.createElement('a');
      linkSvg.href = url;
      linkSvg.download = `${filename}.svg`;
      document.body.appendChild(linkSvg);
      linkSvg.click();
      document.body.removeChild(linkSvg);
      URL.revokeObjectURL(url);
  };

  // --- Render Steps ---

  const Steps = ["Initialization", "Data Upload", "Variables", "Data Quality", "Outliers", "Univariate", "Bivariate", "Correlation"];

  const renderSidebar = () => (
      <div className="hidden md:flex flex-col w-64 bg-white border-r h-screen fixed left-0 top-0 z-10 overflow-y-auto">
          <div className="p-6 bg-blue-50 border-b">
              <h1 className="text-xl font-bold text-blue-900">PyStat Analyzer</h1>
          </div>
          <div className="flex-1 py-4">
              {Steps.map((s, i) => (
                  <div key={i} className={`px-6 py-3 flex items-center text-sm font-medium ${currentStep === i ? 'text-blue-700 bg-blue-50 border-r-4 border-blue-600' : 'text-gray-500'}`}>
                      <div className={`w-6 h-6 rounded-full mr-3 flex items-center justify-center text-xs ${currentStep === i ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                          {i + 1}
                      </div>
                      {s}
                  </div>
              ))}
          </div>
      </div>
  );

  const renderQuality = () => (
      <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800">Data Quality Check</h2>
          
          {/* Summary */}
          <div className="bg-white p-6 rounded-xl shadow-sm border grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="text-center">
                 <p className="text-sm text-gray-500">Rows</p>
                 <p className="text-2xl font-bold">{metadata?.rows}</p>
             </div>
             <div className="text-center">
                 <p className="text-sm text-gray-500">Columns</p>
                 <p className="text-2xl font-bold">{selectedIVs.length + 1}</p>
             </div>
             <div className="text-center">
                 <p className="text-sm text-gray-500">Issues</p>
                 <p className={`text-2xl font-bold ${issues.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{issues.length}</p>
             </div>
          </div>

          {issues.length > 0 ? (
              <>
                  <div className="bg-red-50 border border-red-100 p-4 rounded-lg flex justify-between items-center">
                      <span className="text-red-800 font-medium flex items-center">
                          <AlertCircle className="w-5 h-5 mr-2"/> Found {issues.length} issues (missing values)
                      </span>
                  </div>
                  
                  <div className="bg-white shadow-sm rounded-lg overflow-hidden">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50 border-b">
                              <tr>
                                  <th className="px-4 py-2">Row</th>
                                  <th className="px-4 py-2">Column</th>
                                  <th className="px-4 py-2">Action</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y">
                              {issues.slice(0, 10).map((iss, idx) => (
                                  <tr key={idx}>
                                      <td className="px-4 py-2 font-mono">{iss.row}</td>
                                      <td className="px-4 py-2">{iss.column}</td>
                                      <td className="px-4 py-2">
                                          <button 
                                            onClick={() => { setManualEditIssue(iss); setManualEditValue(''); }}
                                            className="text-blue-600 hover:underline flex items-center"
                                          >
                                            <Edit2 className="w-3 h-3 mr-1"/> Fix Manually
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                              {issues.length > 10 && (
                                  <tr><td colSpan={3} className="px-4 py-2 text-center text-gray-500">... and {issues.length - 10} more</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                      <h3 className="font-bold text-lg">Bulk Actions</h3>
                      <div className="flex flex-wrap gap-4">
                          <button 
                            onClick={() => handleQualityAction('delete')}
                            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium"
                          >
                            Delete Rows
                          </button>
                          
                          <div className="flex items-center space-x-2 border-l pl-4">
                             <span className="text-gray-600 text-sm">Impute with:</span>
                             <button onClick={() => handleQualityAction('impute_mean')} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded">Mean</button>
                             <button onClick={() => handleQualityAction('impute_median')} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded">Median</button>
                             <button onClick={() => handleQualityAction('impute_mode')} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded">Mode</button>
                          </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                          Imputation applies to: {imputeTargetVars.join(', ')}
                      </div>
                  </div>
              </>
          ) : (
              <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4"/>
                  <h3 className="text-xl font-bold text-gray-800">Data is Clean</h3>
                  <p className="text-gray-500 mb-6">No missing values detected.</p>
                  <button 
                    onClick={async () => {
                        const out = await pyService.detectOutliers(outlierMethod);
                        setOutliers(out);
                        setCurrentStep(AppStep.OUTLIER_DETECTION);
                    }}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                  >
                    Proceed to Outliers
                  </button>
              </div>
          )}

          {manualEditIssue && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-xl w-80 shadow-2xl">
                      <h3 className="font-bold mb-4">Fix Value</h3>
                      <p className="text-sm text-gray-500 mb-2">Row: {manualEditIssue.row}, Col: {manualEditIssue.column}</p>
                      <input 
                        type="number" 
                        value={manualEditValue} 
                        onChange={e => setManualEditValue(e.target.value)}
                        className="w-full border p-2 rounded mb-4"
                        placeholder="Enter numeric value"
                      />
                      <div className="flex justify-end space-x-2">
                          <button onClick={() => setManualEditIssue(null)} className="px-3 py-1 text-gray-600">Cancel</button>
                          <button onClick={handleManualEditSubmit} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
                      </div>
                  </div>
              </div>
          )}
      </div>
  );

  const renderOutliers = () => (
      <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800">Outlier Detection</h2>
            <select 
                value={outlierMethod} 
                onChange={(e) => handleOutlierMethodChange(e.target.value as OutlierMethod)}
                className="border p-2 rounded-lg bg-white"
            >
                <option value={OutlierMethod.IQR}>IQR Method</option>
                <option value={OutlierMethod.Z_SCORE}>Z-Score</option>
                <option value={OutlierMethod.MODIFIED_Z}>Modified Z-Score</option>
            </select>
          </div>

          {Object.keys(outliers).length === 0 ? (
               <div className="bg-green-50 p-8 rounded-xl text-center text-green-800">
                   <p>No outliers detected with current method.</p>
               </div>
          ) : (
               <div className="grid gap-6">
                   {Object.keys(outliers).map(col => (
                       <div key={col} className="bg-white p-6 rounded-xl shadow-sm border">
                           <div className="flex justify-between items-start mb-4">
                               <div>
                                   <h3 className="font-bold text-lg text-slate-800">{col}</h3>
                                   <p className="text-sm text-red-600 font-medium">{outliers[col].count} Outliers Found</p>
                               </div>
                               <div className="text-right">
                                   <p className="text-xs text-gray-500 mb-1">Values preview</p>
                                   <div className="text-xs font-mono bg-gray-100 p-2 rounded max-w-[150px] overflow-hidden whitespace-nowrap text-ellipsis">
                                       {outliers[col].values.slice(0, 5).join(', ')}...
                                   </div>
                               </div>
                           </div>
                           
                           <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                               <button onClick={() => handleOutlierAction(col, OutlierAction.IGNORE)} className="px-3 py-1 border rounded hover:bg-gray-50 text-sm">Ignore</button>
                               <button onClick={() => handleOutlierAction(col, OutlierAction.DELETE)} className="px-3 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 text-sm">Delete Row</button>
                               <button onClick={() => handleOutlierAction(col, OutlierAction.WINSORIZE)} className="px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-sm">Winsorize</button>
                               <button onClick={() => handleOutlierAction(col, OutlierAction.IMPUTE_MEAN)} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 text-sm">Mean</button>
                               <button onClick={() => handleOutlierAction(col, OutlierAction.TRANSFORM_LOG)} className="px-3 py-1 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 text-sm">Log</button>
                               <button onClick={() => handleOutlierAction(col, OutlierAction.TRANSFORM_SQRT)} className="px-3 py-1 bg-pink-50 text-pink-700 rounded hover:bg-pink-100 text-sm">Sqrt</button>
                           </div>
                       </div>
                   ))}
               </div>
          )}

          <div className="flex justify-end mt-8">
              <button 
                onClick={() => {
                    setActiveUniVar(selectedDV);
                    generateUniPlot(selectedDV, 'norm');
                    setCurrentStep(AppStep.UNIVARIATE_ANALYSIS);
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center"
              >
                Next: Univariate Analysis <ArrowRight className="w-5 h-5 ml-2"/>
              </button>
          </div>
      </div>
  );

  const renderUnivariate = () => (
      <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800">Univariate Analysis</h2>
          
          <div className="flex items-center space-x-4 mb-6 overflow-x-auto pb-2">
              {[selectedDV, ...selectedIVs].map(v => (
                  <button
                    key={v}
                    onClick={() => { setActiveUniVar(v); generateUniPlot(v, qqDist); }}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeUniVar === v ? 'bg-blue-600 text-white shadow-md' : 'bg-white border hover:bg-gray-50'}`}
                  >
                    {v}
                  </button>
              ))}
          </div>

          {activeUniVar && uniPlots[activeUniVar] && (
              <div className="space-y-8">
                  <div className="grid md:grid-cols-2 gap-6">
                      {/* KDE */}
                      <div className="bg-white p-4 rounded-xl shadow-sm border relative group">
                          <button onClick={() => setMaximizedImg(uniPlots[activeUniVar].kde.png)} className="absolute top-2 right-12 p-2 bg-white/80 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 className="w-4 h-4"/></button>
                          <button onClick={() => downloadImage(uniPlots[activeUniVar].kde, `${activeUniVar}_kde`)} className="absolute top-2 right-2 p-2 bg-white/80 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"><Download className="w-4 h-4"/></button>
                          <img src={`data:image/png;base64,${uniPlots[activeUniVar].kde.png}`} alt="KDE" className="w-full rounded"/>
                      </div>
                      {/* Box */}
                      <div className="bg-white p-4 rounded-xl shadow-sm border relative group">
                          <button onClick={() => setMaximizedImg(uniPlots[activeUniVar].box.png)} className="absolute top-2 right-12 p-2 bg-white/80 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 className="w-4 h-4"/></button>
                          <button onClick={() => downloadImage(uniPlots[activeUniVar].box, `${activeUniVar}_box`)} className="absolute top-2 right-2 p-2 bg-white/80 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"><Download className="w-4 h-4"/></button>
                          <img src={`data:image/png;base64,${uniPlots[activeUniVar].box.png}`} alt="Box" className="w-full rounded"/>
                      </div>
                  </div>
                  {/* QQ */}
                  <div className="bg-white p-4 rounded-xl shadow-sm border relative group max-w-2xl mx-auto">
                      <div className="absolute top-4 left-4 z-10">
                          <select 
                            value={qqDist} 
                            onChange={(e) => { setQqDist(e.target.value); generateUniPlot(activeUniVar, e.target.value); }}
                            className="text-xs border p-1 rounded bg-white/90 backdrop-blur"
                          >
                              <option value="norm">Normal</option>
                              <option value="t">t-distribution</option>
                              <option value="uniform">Uniform</option>
                          </select>
                      </div>
                      <button onClick={() => setMaximizedImg(uniPlots[activeUniVar].qq.png)} className="absolute top-2 right-12 p-2 bg-white/80 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 className="w-4 h-4"/></button>
                      <button onClick={() => downloadImage(uniPlots[activeUniVar].qq, `${activeUniVar}_qq`)} className="absolute top-2 right-2 p-2 bg-white/80 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"><Download className="w-4 h-4"/></button>
                      <img src={`data:image/png;base64,${uniPlots[activeUniVar].qq.png}`} alt="QQ" className="w-full rounded"/>
                  </div>
              </div>
          )}

          <div className="flex justify-end mt-8">
              <button 
                onClick={() => {
                    updateScatter();
                    setCurrentStep(AppStep.BIVARIATE_ANALYSIS);
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center"
              >
                Next: Bivariate Analysis <ArrowRight className="w-5 h-5 ml-2"/>
              </button>
          </div>
      </div>
  );

  const renderBivariate = () => (
      <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800">Bivariate Analysis</h2>
          
          <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border mb-6">
              <button 
                disabled={activeBivariateIVIndex === 0}
                onClick={() => { setActiveBivariateIVIndex(i => i - 1); }}
                className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30"
              >
                  <ChevronLeft className="w-6 h-6"/>
              </button>
              <div className="text-center">
                  <p className="text-sm text-gray-500">DV vs IV</p>
                  <h3 className="font-bold text-lg">{selectedDV} vs {selectedIVs[activeBivariateIVIndex]}</h3>
              </div>
              <button 
                disabled={activeBivariateIVIndex === selectedIVs.length - 1}
                onClick={() => { setActiveBivariateIVIndex(i => i + 1); }}
                className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30"
              >
                  <ChevronRight className="w-6 h-6"/>
              </button>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
              <div className="col-span-2 bg-white p-2 rounded-xl shadow-sm border relative group">
                  {scatterImg ? (
                      <>
                        <button onClick={() => setMaximizedImg(scatterImg.png)} className="absolute top-2 right-12 p-2 bg-white/80 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 className="w-4 h-4"/></button>
                        <button onClick={() => downloadImage(scatterImg, `scatter_${selectedDV}_${selectedIVs[activeBivariateIVIndex]}`)} className="absolute top-2 right-2 p-2 bg-white/80 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"><Download className="w-4 h-4"/></button>
                        <img src={`data:image/png;base64,${scatterImg.png}`} className="w-full rounded" alt="Scatter"/>
                      </>
                  ) : (
                      <div className="h-64 flex items-center justify-center text-gray-400">Generating...</div>
                  )}
              </div>
              
              <div className="space-y-4">
                  <div className="bg-white p-6 rounded-xl shadow-sm border">
                      <h4 className="font-bold mb-4 text-slate-700">Plot Options</h4>
                      <div className="space-y-3">
                          <label className="flex items-center space-x-2 cursor-pointer">
                              <input type="checkbox" checked={true} readOnly className="text-blue-600 rounded"/>
                              <span>Raw Points</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                              <input type="checkbox" checked={scatterOpts.line} onChange={e => setScatterOpts({...scatterOpts, line: e.target.checked})} className="text-blue-600 rounded"/>
                              <span>Linear Regression</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                              <input type="checkbox" checked={scatterOpts.lowess} onChange={e => setScatterOpts({...scatterOpts, lowess: e.target.checked})} className="text-blue-600 rounded"/>
                              <span>LOWESS</span>
                          </label>
                          <div className="pt-2 border-t">
                              <label className="block text-sm mb-1">Polynomial Degree</label>
                              <select 
                                value={scatterOpts.poly || ''} 
                                onChange={e => setScatterOpts({...scatterOpts, poly: e.target.value ? Number(e.target.value) : null})}
                                className="w-full border p-2 rounded"
                              >
                                  <option value="">None</option>
                                  <option value="2">Degree 2</option>
                                  <option value="3">Degree 3</option>
                                  <option value="4">Degree 4</option>
                              </select>
                          </div>
                          <button onClick={updateScatter} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm">Update Plot</button>
                      </div>
                  </div>
              </div>
          </div>

          <div className="flex justify-end mt-8">
              <button 
                onClick={handleCalcCorrelations}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center"
              >
                Next: Correlations <ArrowRight className="w-5 h-5 ml-2"/>
              </button>
          </div>
      </div>
  );

  const renderCorrelations = () => (
      <div className="space-y-6">
          <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-800">Correlation Analysis</h2>
              <button 
                onClick={() => pyService.downloadCorrelationPDF(selectedDV, selectedIVs)}
                className="flex items-center space-x-2 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg font-medium"
              >
                  <FileText className="w-5 h-5"/> <span>Download Report (PDF)</span>
              </button>
          </div>

          <div className="flex space-x-4 border-b pb-1">
              <button onClick={() => setShowCorrTable(true)} className={`px-4 py-2 font-medium border-b-2 ${showCorrTable ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>Table View</button>
              <button onClick={() => setShowCorrTable(false)} className={`px-4 py-2 font-medium border-b-2 ${!showCorrTable ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>Heatmaps</button>
          </div>

          {corrData && (
              showCorrTable ? (
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 border-b">
                              <tr>
                                  <th className="px-6 py-3">Variable</th>
                                  <th className="px-6 py-3 text-center border-l">Pearson (r)</th>
                                  <th className="px-6 py-3 text-center">p-value</th>
                                  <th className="px-6 py-3 text-center">95% CI</th>
                                  <th className="px-6 py-3 text-center border-l">Spearman (r)</th>
                                  <th className="px-6 py-3 text-center border-l">Kendall (tau)</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y">
                              {corrData.table.map((row: any) => (
                                  <tr key={row.variable} className="hover:bg-gray-50">
                                      <td className="px-6 py-4 font-medium">{row.variable}</td>
                                      <td className="px-6 py-4 text-center border-l font-mono">{row.pearson.r.toFixed(3)}</td>
                                      <td className="px-6 py-4 text-center font-mono text-xs">{row.pearson.p < 0.001 ? '<0.001' : row.pearson.p.toFixed(3)}</td>
                                      <td className="px-6 py-4 text-center font-mono text-xs">[{row.pearson.ci[0].toFixed(2)}, {row.pearson.ci[1].toFixed(2)}]</td>
                                      <td className="px-6 py-4 text-center border-l font-mono">{row.spearman.r.toFixed(3)}</td>
                                      <td className="px-6 py-4 text-center border-l font-mono">{row.kendall.r.toFixed(3)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                      {['pearson', 'spearman', 'kendall'].map(method => (
                          <div key={method} className="bg-white p-4 rounded-xl shadow-sm border">
                              <h4 className="font-bold mb-2 capitalize text-center">{method}</h4>
                              <img src={`data:image/png;base64,${corrData[`heatmap_${method}`].png}`} className="w-full rounded" alt={method}/>
                          </div>
                      ))}
                  </div>
              )
          )}
      </div>
  );

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex">
        <LoadingOverlay isVisible={pyStatus.isLoading} message={pyStatus.message} />
        
        {/* Sidebar */}
        {renderSidebar()}

        {/* Main Content */}
        <div className="flex-1 md:ml-64 p-8">
            {currentStep === AppStep.INITIALIZATION ? (
                 <div className="flex flex-col items-center justify-center h-[80vh]">
                    <div className="loader mb-6 w-16 h-16 border-4 border-t-blue-600 border-gray-200 rounded-full animate-spin"></div>
                    <h2 className="text-2xl font-bold text-slate-700 mb-2">Initializing Statistical Engine</h2>
                    <p className="text-slate-500 mb-8">{pyStatus.message}</p>
                    <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${pyStatus.progress}%` }}></div>
                    </div>
                </div>
            ) : (
                <>
                    {currentStep === AppStep.DATA_UPLOAD && (
                        <div className="max-w-2xl mx-auto mt-10 bg-white p-8 rounded-xl shadow-sm border">
                            <h2 className="text-2xl font-bold text-slate-800 mb-6">Upload Dataset</h2>
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:bg-slate-50 transition-colors relative">
                                <input type="file" accept=".csv,.xls,.xlsx" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                <p className="text-lg font-medium text-slate-700">Drop CSV or Excel file here</p>
                                <p className="text-sm text-slate-500 mt-2">Max 50 MB</p>
                            </div>
                            {error && <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center"><AlertCircle className="w-5 h-5 mr-2"/>{error}</div>}
                        </div>
                    )}

                    {currentStep === AppStep.VARIABLE_SELECTION && (
                        <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-sm">
                            <h2 className="text-2xl font-bold text-slate-800 mb-6">Variable Selection</h2>
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="bg-blue-50 p-6 rounded-xl">
                                    <h3 className="font-bold text-blue-900 mb-4 flex items-center"><Activity className="w-5 h-5 mr-2"/> Dependent Variable (Target)</h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                        {metadata?.summary.filter(c => c.type === 'numeric').map(col => (
                                            <label key={col.name} className="flex items-center p-2 bg-white rounded shadow-sm cursor-pointer hover:bg-blue-50 border border-transparent hover:border-blue-200">
                                                <input type="radio" name="dv" value={col.name} checked={selectedDV === col.name} onChange={(e) => setSelectedDV(e.target.value)} className="text-blue-600 focus:ring-blue-500 h-4 w-4"/>
                                                <span className="ml-3 text-sm font-medium text-slate-700">{col.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-xl">
                                    <h3 className="font-bold text-slate-900 mb-4 flex items-center"><BarChart2 className="w-5 h-5 mr-2"/> Independent Variables (Features)</h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                        {metadata?.summary.filter(c => c.type === 'numeric' && c.name !== selectedDV).map(col => (
                                            <label key={col.name} className="flex items-center p-2 bg-white rounded shadow-sm cursor-pointer hover:bg-slate-100">
                                                <input type="checkbox" value={col.name} checked={selectedIVs.includes(col.name)} onChange={(e) => { if (e.target.checked) setSelectedIVs([...selectedIVs, col.name]); else setSelectedIVs(selectedIVs.filter(v => v !== col.name)); }} className="text-blue-600 focus:ring-blue-500 h-4 w-4 rounded"/>
                                                <span className="ml-3 text-sm font-medium text-slate-700">{col.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {error && <div className="mt-6 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
                            <div className="mt-8 flex justify-end">
                                <button onClick={handleVariableSubmit} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center">Start Analysis <ArrowRight className="ml-2 w-5 h-5"/></button>
                            </div>
                        </div>
                    )}

                    {currentStep === AppStep.DATA_QUALITY && renderQuality()}
                    {currentStep === AppStep.OUTLIER_DETECTION && renderOutliers()}
                    {currentStep === AppStep.UNIVARIATE_ANALYSIS && renderUnivariate()}
                    {currentStep === AppStep.BIVARIATE_ANALYSIS && renderBivariate()}
                    {currentStep === AppStep.CORRELATION_ANALYSIS && renderCorrelations()}
                </>
            )}
        </div>

        {/* Image Modal */}
        {maximizedImg && (
            <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4" onClick={() => setMaximizedImg(null)}>
                <button className="absolute top-4 right-4 text-white"><XCircle className="w-8 h-8"/></button>
                <img src={`data:image/png;base64,${maximizedImg}`} className="max-w-full max-h-full rounded" alt="Full size"/>
            </div>
        )}
    </div>
  );
};

export default App;
