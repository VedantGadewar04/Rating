import React, { useCallback, useEffect, useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  Backdrop,
  CircularProgress,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  IconButton,
  Skeleton,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import StopIcon from '@mui/icons-material/HighlightOffOutlined';
import WriteIcon from '@mui/icons-material/EditNoteOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import CopyIcon from '@mui/icons-material/ContentPasteOutlined';
import { type BBoardDerivedState as MidnightMoonDerivedState, type DeployedBBoardAPI as DeployedMidnightMoonAPI } from '../../../midnight-moon-api/src/index';
import { useDeployedBoardContext } from '../hooks';
import { type BoardDeployment } from '../contexts';
import { type Observable } from 'rxjs';
import { EmptyCardContent } from './Board.EmptyCardContent';

export interface BoardProps {
  boardDeployment$?: Observable<BoardDeployment>;
}

export const Board: React.FC<Readonly<BoardProps>> = ({ boardDeployment$ }) => {
  const boardApiProvider = useDeployedBoardContext();
  const [boardDeployment, setBoardDeployment] = useState<BoardDeployment>();
  const [deployedBoardAPI, setDeployedBoardAPI] = useState<DeployedMidnightMoonAPI>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [boardState, setBoardState] = useState<MidnightMoonDerivedState>();
  const [sectorInput, setSectorInput] = useState<string>('');
  const [secretInput, setSecretInput] = useState<string>('');
  const [isWorking, setIsWorking] = useState(!!boardDeployment$);

  const onCreateBoard = useCallback(() => boardApiProvider.resolve(), [boardApiProvider]);
  const onJoinBoard = useCallback(
    (contractAddress: ContractAddress) => boardApiProvider.resolve(contractAddress),
    [boardApiProvider],
  );

  const onClaimSector = useCallback(async () => {
    if (!sectorInput || !secretInput) {
      return;
    }
    try {
      if (deployedBoardAPI) {
        setIsWorking(true);
        setErrorMessage(undefined);
        await deployedBoardAPI.claimSector(sectorInput, secretInput);
        setSectorInput('');
        setSecretInput('');
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedBoardAPI, sectorInput, secretInput]);

  const onReleaseSector = useCallback(async () => {
    if (!sectorInput || !secretInput) {
      return;
    }
    try {
      if (deployedBoardAPI) {
        setIsWorking(true);
        setErrorMessage(undefined);
        await deployedBoardAPI.releaseSector(sectorInput, secretInput);
        setSectorInput('');
        setSecretInput('');
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedBoardAPI, sectorInput, secretInput]);

  const onCopyContractAddress = useCallback(async () => {
    if (deployedBoardAPI) {
      await navigator.clipboard.writeText(deployedBoardAPI.deployedContractAddress);
    }
  }, [deployedBoardAPI]);

  useEffect(() => {
    if (!boardDeployment$) {
      return;
    }
    const subscription = boardDeployment$.subscribe(setBoardDeployment);
    return () => {
      subscription.unsubscribe();
    };
  }, [boardDeployment$]);

  useEffect(() => {
    if (!boardDeployment) {
      return;
    }
    if (boardDeployment.status === 'in-progress') {
      return;
    }
    setIsWorking(false);
    if (boardDeployment.status === 'failed') {
      setErrorMessage(
        boardDeployment.error.message.length ? boardDeployment.error.message : 'Encountered an unexpected error.',
      );
      return;
    }
    setDeployedBoardAPI(boardDeployment.api);
    const subscription = boardDeployment.api.state$.subscribe(setBoardState);
    return () => {
      subscription.unsubscribe();
    };
  }, [boardDeployment]);

  // Count claimed sectors
  const claimedCount = boardState ? Object.values(boardState.claimedSectors).filter(Boolean).length : 0;

  return (
    <Card sx={{ position: 'relative', width: 340, height: 480, minWidth: 340, minHeight: 480 }} color="primary">
      {!boardDeployment$ && (
        <EmptyCardContent onCreateBoardCallback={onCreateBoard} onJoinBoardCallback={onJoinBoard} />
      )}

      {boardDeployment$ && (
        <React.Fragment>
          <Backdrop
            sx={{ position: 'absolute', color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={isWorking}
          >
            <CircularProgress data-testid="board-working-indicator" />
          </Backdrop>
          
          {errorMessage && (
            <Backdrop
              sx={{ position: 'absolute', color: '#ff0000', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: (theme) => theme.zIndex.drawer + 2, display: 'flex', flexDirection: 'column', p: 2 }}
              open={!!errorMessage}
            >
              <IconButton onClick={() => setErrorMessage(undefined)} sx={{ color: 'red', alignSelf: 'flex-end' }}>
                <StopIcon />
              </IconButton>
              <Typography component="div" sx={{ mt: 2, textAlign: 'center' }} data-testid="board-error-message">
                {errorMessage}
              </Typography>
            </Backdrop>
          )}

          <CardHeader
            title={toShortFormatContractAddress(deployedBoardAPI?.deployedContractAddress) ?? 'Loading...'}
            titleTypographyProps={{ color: 'primary', variant: 'subtitle2' }}
            action={
              deployedBoardAPI?.deployedContractAddress ? (
                <IconButton title="Copy contract address" onClick={onCopyContractAddress}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              ) : (
                <Skeleton variant="circular" width={20} height={20} />
              )
            }
          />
          <CardContent sx={{ pt: 0, height: '340px', overflowY: 'auto' }}>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
              Claimed Lunar Sectors ({claimedCount})
            </Typography>
            {boardState ? (
              <List dense sx={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #ccc', borderRadius: 1, mb: 2 }}>
                {Object.entries(boardState.claimedSectors).map(([sectorId, isClaimed]) => {
                  if (!isClaimed) return null;
                  const comm = boardState.commitments[sectorId] || 'Unknown';
                  return (
                    <ListItem key={sectorId} divider>
                      <ListItemText>
                        <div>
                          <Typography variant="caption" color="textPrimary">
                            Coord: {sectorId.slice(0, 10)}...
                          </Typography>
                        </div>
                        <div>
                          <Typography variant="caption" color="textSecondary">
                            Commitment: {comm.slice(0, 10)}...
                          </Typography>
                        </div>
                      </ListItemText>
                    </ListItem>
                  );
                })}
                {claimedCount === 0 && (
                  <ListItem>
                    <ListItemText>
                      <Typography variant="caption" color="textSecondary">
                        No sectors claimed yet.
                      </Typography>
                    </ListItemText>
                  </ListItem>
                )}
              </List>
            ) : (
              <Skeleton variant="rectangular" width="100%" height={100} sx={{ mb: 2 }} />
            )}

            <TextField
              label="Sector Coord (32-byte Hex)"
              variant="outlined"
              fullWidth
              size="small"
              value={sectorInput}
              onChange={(e) => setSectorInput(e.target.value)}
              sx={{ mb: 1.5 }}
            />
            <TextField
              label="Owner Secret (32-byte Hex)"
              variant="outlined"
              fullWidth
              size="small"
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              sx={{ mb: 1.5 }}
            />
          </CardContent>
          <CardActions sx={{ justifyContent: 'space-around', pb: 2 }}>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<WriteIcon />}
              onClick={onClaimSector}
              disabled={!sectorInput || !secretInput || !deployedBoardAPI}
            >
              Claim
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={onReleaseSector}
              disabled={!sectorInput || !secretInput || !deployedBoardAPI}
            >
              Release
            </Button>
          </CardActions>
        </React.Fragment>
      )}
    </Card>
  );
};

const toShortFormatContractAddress = (contractAddress: ContractAddress | undefined): React.ReactElement | undefined =>
  contractAddress ? (
    <span data-testid="board-address">
      0x{contractAddress?.replace(/^[A-Fa-f0-9]{6}([A-Fa-f0-9]{8}).*([A-Fa-f0-9]{8})$/g, '$1...$2')}
    </span>
  ) : undefined;
