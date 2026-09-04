import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// --- 15 MATKA FAMILIES WITH PASTEL COLORS ---
const JODI_FAMILIES: Record<string, { members: string[]; color: string }> = {
  "01": { members: ["01", "10", "06", "60", "51", "15", "56", "65"], color: "#FFE1E6" },
  "02": { members: ["02", "20", "07", "70", "52", "25", "57", "75"], color: "#E2F0D9" },
  "03": { members: ["03", "30", "08", "80", "53", "35", "58", "85"], color: "#FFF2CC" },
  "04": { members: ["04", "40", "09", "90", "54", "45", "59", "95"], color: "#FCE4D6" },
  "05": { members: ["05", "50", "00", "55"], color: "#EDEDED" },
  "12": { members: ["12", "21", "17", "71", "62", "26", "67", "76"], color: "#D9E1F2" },
  "13": { members: ["13", "31", "18", "81", "63", "36", "68", "86"], color: "#E1D5E7" },
  "14": { members: ["14", "41", "19", "91", "64", "46", "69", "96"], color: "#D5E8D4" },
  "16": { members: ["16", "61", "11", "66"], color: "#F8CECC" },
  "23": { members: ["23", "32", "28", "82", "73", "37", "78", "87"], color: "#DAE8FC" },
  "24": { members: ["24", "42", "29", "92", "74", "47", "79", "97"], color: "#FFF2CC" },
  "27": { members: ["27", "72", "22", "77"], color: "#E1F5FE" },
  "34": { members: ["34", "43", "39", "93", "84", "48", "89", "98"], color: "#F3E5F5" },
  "38": { members: ["38", "83", "33", "88"], color: "#E8F5E9" },
  "49": { members: ["49", "94", "44", "99"], color: "#FFFDE7" }
};

const CUSTOM_HIGHLIGHT_COLOR = "#00e676";

const checkSameFamily = (jodi1: string, jodi2: string): boolean => {
  if (!jodi1 || !jodi2 || jodi1.includes('*') || jodi2.includes('*') || jodi1.includes('✪')) return false;
  for (const fam of Object.values(JODI_FAMILIES)) {
    if (fam.members.includes(jodi1) && fam.members.includes(jodi2)) return true;
  }
  return false;
};

const calculateMetrics = (jodiStr: string) => {
  if (!jodiStr || jodiStr.length < 2 || jodiStr.includes('*') || jodiStr.includes('✪')) {
    return { diff: null, total: null, diffNum: null, totalNum: null };
  }
  const open = parseInt(jodiStr[0], 10);
  const close = parseInt(jodiStr[1], 10);
  if (isNaN(open) || isNaN(close)) return { diff: null, total: null, diffNum: null, totalNum: null };

  const diffNum = (close - open + 10) % 10;
  const totalNum = (open + close) % 10;

  return { diff: `D-${diffNum}`, total: `T-${totalNum}`, diffNum, totalNum };
};

const formatJodiVal = (val: string): string => {
  if (!val) return '';
  const trimmed = String(val).trim();
  return /^\d$/.test(trimmed) ? `0${trimmed}` : trimmed;
};

const formatDateString = (dateVal: string): string => {
  if (!dateVal || dateVal.startsWith('#')) return '---';
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(dateVal)) return dateVal.replace(/\//g, '-');
  const parsed = new Date(dateVal);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  }
  return dateVal;
};

const DAYS: string[] = ["DATE", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const GOOGLE_SHEET_API_URL: string = "https://script.google.com/macros/s/AKfycbw3jWRTYljkZp28TXDEqTeEW_lQHzfzo2IAp6_-j-Ez8dkhO_XGMc4bkMaoVats-25A/exec";

interface CellPosition {
  rowIndex: number;
  colIndex: number;
  value: string;
}

interface MatchResult {
  matchBlock: string[][];
  startDate: string;
  startRowIndex: number;
  matchCount: number;
  matchedPatternLength: number;
  pastRowsCount: number;
}

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loginPin, setLoginPin] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  const [fullSheetData, setFullSheetData] = useState<string[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [dragStartCell, setDragStartCell] = useState<CellPosition | null>(null);
  const [selectedCells, setSelectedCells] = useState<CellPosition[]>([]);
  
  const [matchedSets, setMatchedSets] = useState<MatchResult[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [minMatchCount, setMinMatchCount] = useState<number>(2);
  const [strictMode, setStrictMode] = useState<boolean>(false);

  // CLICKED RESULT CELL FOR HIGHLIGHT
  const [clickedResultCell, setClickedResultCell] = useState<{ blockIdx: number; colIndex: number; value: string } | null>(null);

  const lastRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        setLoading(true);
        const response = await fetch(GOOGLE_SHEET_API_URL);
        const rawData: unknown = await response.json();

        if (Array.isArray(rawData) && rawData.length > 0) {
          const formattedData = (rawData as (string | number)[][]).map((row) =>
            row.map((cell) => (cell !== null && cell !== undefined ? String(cell).trim() : ""))
          );

          const cleanData = formattedData.filter((row) => row.some((c) => c !== ""));
          setFullSheetData(cleanData);
        }
      } catch (error) {
        console.error("Error fetching Google Sheet data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const scrollToBottom = (): void => {
    if (lastRowRef.current) {
      lastRowRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLoginSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (loginPin === '5666') {
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('चुकीचा पिन! कृपया योग्य पिन टाका.');
    }
  };

  const handleStartSelection = (rIdx: number, cIdx: number, value: string): void => {
    if (cIdx === 0) return;
    setIsSelecting(true);
    const startCell = { rowIndex: rIdx, colIndex: cIdx, value: formatJodiVal(value) };
    setDragStartCell(startCell);
    setSelectedCells([startCell]);
    setClickedResultCell(null);
  };

  const handleMoveSelection = (rIdx: number, cIdx: number): void => {
    if (!isSelecting || !dragStartCell || cIdx === 0) return;

    const minRow = Math.min(dragStartCell.rowIndex, rIdx);
    const maxRow = Math.max(dragStartCell.rowIndex, rIdx);
    const minCol = Math.min(dragStartCell.colIndex, cIdx);
    const maxCol = Math.max(dragStartCell.colIndex, cIdx);

    const rectCells: CellPosition[] = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const val = formatJodiVal(fullSheetData[r]?.[c] || "");
        rectCells.push({ rowIndex: r, colIndex: c, value: val });
      }
    }
    setSelectedCells(rectCells);
  };

  const handleEndSelection = (): void => {
    setIsSelecting(false);
  };

  const runPatternSearch = (): void => {
    if (selectedCells.length === 0 || fullSheetData.length === 0) return;

    const minRow = Math.min(...selectedCells.map((c) => c.rowIndex));
    const maxRow = Math.max(...selectedCells.map((c) => c.rowIndex));
    const numRows = maxRow - minRow + 1;
    
    const PAST_ROWS = 10;
    const FUTURE_ROWS = 10;

    const matches: MatchResult[] = [];

    for (let i = 0; i <= fullSheetData.length - numRows; i++) {
      if (i === minRow) continue;

      let matchCount = 0;

      for (const cell of selectedCells) {
        if (!cell.value || cell.value.includes('*') || cell.value.includes('✪')) continue;

        const offsetRow = cell.rowIndex - minRow;
        const targetHistJodi = formatJodiVal(fullSheetData[i + offsetRow]?.[cell.colIndex] || "");

        if (strictMode) {
          if (cell.value === targetHistJodi) matchCount++;
        } else {
          if (checkSameFamily(cell.value, targetHistJodi) || cell.value === targetHistJodi) {
            matchCount++;
          }
        }
      }

      if (matchCount >= minMatchCount) {
        const blockStart = Math.max(0, i - PAST_ROWS);
        const blockEnd = Math.min(fullSheetData.length, i + numRows + FUTURE_ROWS);
        
        const matchBlock = fullSheetData.slice(blockStart, blockEnd);
        const startDate = formatDateString(fullSheetData[i]?.[0] || "");
        const actualPastCount = i - blockStart;

        matches.push({ 
          matchBlock, 
          startDate, 
          startRowIndex: i, 
          matchCount,
          matchedPatternLength: numRows,
          pastRowsCount: actualPastCount
        });
      }
    }

    matches.sort((a, b) => b.matchCount - a.matchCount);
    setMatchedSets(matches);
    setCurrentMatchIndex(0);
    setClickedResultCell(null);
  };

  const handleReset = (): void => {
    setSelectedCells([]);
    setMatchedSets([]);
    setCurrentMatchIndex(0);
    setClickedResultCell(null);
  };

  const handleResultCellClick = (blockIdx: number, colIndex: number, value: string) => {
    if (colIndex === 0 || !value || value.includes('*')) return;
    
    if (clickedResultCell && clickedResultCell.blockIdx === blockIdx && clickedResultCell.colIndex === colIndex) {
      setClickedResultCell(null);
    } else {
      setClickedResultCell({ blockIdx, colIndex, value });
    }
  };

  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#2c3e50' }}>
        <form onSubmit={handleLoginSubmit} style={{ background: '#fff', padding: '30px', borderRadius: '8px', width: '280px', textAlign: 'center' }}>
          <h3>Matka App Login</h3>
          <input 
            type="password" 
            placeholder="Enter Security PIN" 
            value={loginPin} 
            onChange={(e) => setLoginPin(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
          />
          {loginError && <p style={{ color: 'red', fontSize: '12px' }}>{loginError}</p>}
          <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#27ae60', color: '#fff', border: 'none' }}>
            Login
          </button>
        </form>
      </div>
    );
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>Loading Data...</div>;

  const currentMatch = matchedSets[currentMatchIndex] || null;

  // --- STRICT SAME POSITION HIGHLIGHT LOGIC ---
  const resultHighlightedPositions: { blockIdx: number; colIndex: number }[] = [];
  const mainHighlightedPositions: { rowIndex: number; colIndex: number }[] = [];

  if (currentMatch && clickedResultCell) {
    const clickedVal = clickedResultCell.value;

    // 1. Result Sheet मधील फॅमिली जुळणाऱ्या Cells पोझिशन साठवा
    currentMatch.matchBlock.forEach((week, bIdx) => {
      week.forEach((rawVal, cIdx) => {
        if (cIdx > 0) {
          const val = formatJodiVal(rawVal);
          if (val === clickedVal || checkSameFamily(val, clickedVal)) {
            resultHighlightedPositions.push({ blockIdx: bIdx, colIndex: cIdx });
          }
        }
      });
    });

    // 2. Main Sheet मधील फक्त आणि फक्त EXACT SAME POSITION चे Cells शोधा
    const matchStartRow = currentMatch.startRowIndex;
    const pastOffset = currentMatch.pastRowsCount;

    resultHighlightedPositions.forEach((pos) => {
      const correspondingMainRowIndex = matchStartRow - pastOffset + pos.blockIdx;
      if (correspondingMainRowIndex >= 0 && correspondingMainRowIndex < fullSheetData.length) {
        mainHighlightedPositions.push({
          rowIndex: correspondingMainRowIndex,
          colIndex: pos.colIndex
        });
      }
    });
  }

  return (
    <div className="app-wrapper">
      <header className="app-header" style={{ padding: '8px', background: '#2c3e50', color: '#fff' }}>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '16px', textAlign: 'center' }}>Matka Pattern Finder App</h2>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '12px' }}>
            किमान जुळणाऱ्या जोड्या:
            <select value={minMatchCount} onChange={(e) => setMinMatchCount(parseInt(e.target.value, 10))}>
              {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}+</option>)}
            </select>
          </label>

          <label style={{ fontSize: '12px', color: '#ffeb3b', fontWeight: 'bold' }}>
            <input type="checkbox" checked={strictMode} onChange={(e) => setStrictMode(e.target.checked)} />
            Strict Exact Match Mode
          </label>

          <button onClick={runPatternSearch} disabled={selectedCells.length === 0} style={{ padding: '4px 10px', backgroundColor: '#27ae60', color: '#fff', border: 'none' }}>
            Find Pattern
          </button>

          <button onClick={handleReset} style={{ padding: '4px 10px', backgroundColor: '#e74c3c', color: '#fff', border: 'none' }}>
            Reset
          </button>

          <button onClick={scrollToBottom} style={{ padding: '4px 10px', backgroundColor: '#3498db', color: '#fff', border: 'none' }}>
            Go To Bottom ⬇
          </button>

          {matchedSets.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#34495e', padding: '3px 6px' }}>
              <button onClick={() => { setCurrentMatchIndex((prev) => Math.max(0, prev - 1)); setClickedResultCell(null); }} disabled={currentMatchIndex === 0}>◀ Prev</button>
              <span style={{ fontSize: '12px' }}>Match {currentMatchIndex + 1} of {matchedSets.length}</span>
              <button onClick={() => { setCurrentMatchIndex((prev) => Math.min(matchedSets.length - 1, prev + 1)); setClickedResultCell(null); }} disabled={currentMatchIndex === matchedSets.length - 1}>Next ▶</button>
            </div>
          )}
        </div>
      </header>

      <div className="side-by-side-container" style={{ display: 'flex', gap: '10px', padding: '8px' }}>
        
        {/* LEFT PANEL: FULL SHEET HISTORY */}
        <div className="panel-container" style={{ flex: 1, overflowX: 'auto', maxHeight: '80vh', overflowY: 'auto' }}>
          <h3 style={{ background: '#34495e', color: '#fff', padding: '4px', margin: 0, fontSize: '13px', position: 'sticky', top: 0, zIndex: 10 }}>
            FULL SHEET HISTORY
          </h3>
          <table className="matka-pdf-table" onMouseUp={handleEndSelection} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead style={{ position: 'sticky', top: '25px', zIndex: 9, background: '#fff' }}>
              <tr>
                {DAYS.map((day, idx) => (
                  <th key={day} style={{ width: idx === 0 ? '70px' : 'auto', fontSize: '11px' }}>{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fullSheetData.map((week, rIdx) => {
                const isLastRow = rIdx === fullSheetData.length - 1;

                return (
                  <tr key={`full-row-${rIdx}`} ref={isLastRow ? lastRowRef : null}>
                    {week.map((rawVal, cIdx) => {
                      if (cIdx === 0) {
                        return <td key={`full-date-${rIdx}`} style={{ fontSize: '10px', padding: '2px' }}>{formatDateString(rawVal)}</td>;
                      }

                      const formattedVal = formatJodiVal(rawVal);
                      const isSelected = selectedCells.some((cell) => cell.rowIndex === rIdx && cell.colIndex === cIdx);

                      // EXACT SAME POSITION MAIN HIGHLIGHT CHECK
                      const isMainHighlighted = mainHighlightedPositions.some(
                        (pos) => pos.rowIndex === rIdx && pos.colIndex === cIdx
                      );

                      const { diff, total } = calculateMetrics(formattedVal);

                      return (
                        <td
                          key={`full-cell-${rIdx}-${cIdx}`}
                          style={{ 
                            backgroundColor: isMainHighlighted ? CUSTOM_HIGHLIGHT_COLOR : isSelected ? '#a0c4ff' : '#ffffff', 
                            color: isMainHighlighted ? '#000000' : '#000000',
                            border: isMainHighlighted ? '2px solid #00c853' : '1px solid #ccc',
                            fontWeight: 'bold',
                            padding: '2px 0',
                            textAlign: 'center',
                            cursor: 'pointer'
                          }}
                          onMouseDown={() => handleStartSelection(rIdx, cIdx, formattedVal)}
                          onMouseEnter={() => handleMoveSelection(rIdx, cIdx)}
                        >
                          <div style={{ fontSize: '14px' }}>{formattedVal || '**'}</div>
                          <div style={{ fontSize: '9px', display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
                            <span style={{ color: '#8b0000' }}>{diff || ''}</span>
                            <span style={{ color: '#006400' }}>{total || ''}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* RIGHT PANEL: MATCHED RESULT HISTORY */}
        <div className="matches-wrapper" style={{ flex: 1, overflowX: 'auto', maxHeight: '80vh', overflowY: 'auto' }}>
          {currentMatch ? (
            <div className="panel-container">
              <h3 style={{ background: '#27ae60', color: '#fff', padding: '4px', margin: 0, fontSize: '13px', position: 'sticky', top: 0, zIndex: 10 }}>
                MATCHED SET {currentMatchIndex + 1} OF {matchedSets.length} ({currentMatch.matchCount} MATCHED) - DATE: {currentMatch.startDate}
              </h3>
              <table className="matka-pdf-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead style={{ position: 'sticky', top: '25px', zIndex: 9, background: '#fff' }}>
                  <tr>
                    {DAYS.map((day, idx) => (
                      <th key={day} style={{ width: idx === 0 ? '70px' : 'auto', fontSize: '11px' }}>{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentMatch.matchBlock.map((week, blockIdx) => (
                    <tr key={`match-row-${blockIdx}`}>
                      {week.map((rawVal, cIdx) => {
                        if (cIdx === 0) {
                          return <td key={`match-date-${blockIdx}`} style={{ fontSize: '10px', padding: '2px' }}>{formatDateString(rawVal)}</td>;
                        }

                        const formattedVal = formatJodiVal(rawVal);

                        // RESULT SHEET HIGHLIGHT CHECK
                        const isResultHighlighted = resultHighlightedPositions.some(
                          (pos) => pos.blockIdx === blockIdx && pos.colIndex === cIdx
                        );

                        const isClicked = clickedResultCell?.blockIdx === blockIdx && clickedResultCell?.colIndex === cIdx;
                        const { diff, total } = calculateMetrics(formattedVal);

                        return (
                          <td
                            key={`match-cell-${blockIdx}-${cIdx}`}
                            onClick={() => handleResultCellClick(blockIdx, cIdx, formattedVal)}
                            style={{ 
                              backgroundColor: isResultHighlighted ? CUSTOM_HIGHLIGHT_COLOR : '#ffffff', 
                              color: '#000000',
                              border: isClicked ? '2px solid #ff0000' : isResultHighlighted ? '2px solid #00c853' : '1px solid #ccc',
                              fontWeight: 'bold',
                              padding: '2px 0',
                              textAlign: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ fontSize: '14px' }}>{formattedVal || '**'}</div>
                            <div style={{ fontSize: '9px', display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
                              <span style={{ color: '#8b0000' }}>{diff || ''}</span>
                              <span style={{ color: '#006400' }}>{total || ''}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', background: '#f9f9f9', border: '1px dashed #ccc' }}>
              <p>डाव्या बाजूच्या Sheet वर सिलेक्ट करा आणि <b>Find Pattern</b> वर क्लिक करा.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default App;
