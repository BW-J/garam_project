import { Dialog } from 'primereact/dialog';
import DaumPostcode from 'react-daum-postcode';

interface AddressData {
  zonecode: string;
  address: string;
}

interface AddressSearchDialogProps {
  visible: boolean;
  onHide: () => void;
  onComplete: (data: AddressData) => void;
}

export default function AddressSearchDialog({
  visible,
  onHide,
  onComplete,
}: AddressSearchDialogProps) {
  const handleComplete = (data: any) => {
    let fullAddress = data.address;
    let extraAddress = '';

    if (data.addressType === 'R') {
      if (data.bname !== '') {
        extraAddress += data.bname;
      }
      if (data.buildingName !== '') {
        extraAddress += extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName;
      }
      fullAddress += extraAddress !== '' ? ` (${extraAddress})` : '';
    }

    onComplete({
      zonecode: data.zonecode,
      address: fullAddress,
    });
    onHide(); // 선택 후 팝업 닫기
  };

  return (
    <Dialog
      header="주소 검색"
      visible={visible}
      onHide={onHide}
      style={{ width: '500px' }}
      breakpoints={{ '960px': '90vw' }}
    >
      <DaumPostcode onComplete={handleComplete} style={{ height: '450px' }} />
    </Dialog>
  );
}
