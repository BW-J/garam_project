import { Card } from 'primereact/card';

const Page500 = () => {
  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <Card>
        <span className="clearfix">
          <h1 className="float-start display-3 me-4">500</h1>
          <h4 className="pt-3">Houston, we have a problem!</h4>
          <p className="text-body-secondary float-start">
            The page you are looking for is temporarily unavailable.
          </p>
        </span>
      </Card>
    </div>
  );
};

export default Page500;
